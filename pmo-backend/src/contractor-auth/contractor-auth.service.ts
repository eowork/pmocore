import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EntityManager } from '@mikro-orm/core';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ContractorUser } from './entities/contractor-user.entity';
import { ContractorInviteToken } from './entities/contractor-invite-token.entity';
import { ProjectContractorAssignment } from './entities/project-contractor-assignment.entity';
import { ContractorRegisterDto } from './dto/contractor-register.dto';
import { ContractorLoginDto } from './dto/contractor-login.dto';
import { GenerateInviteDto } from './dto/generate-invite.dto';
import { User, Role, UserRole } from '../database/entities';

@Injectable()
export class ContractorAuthService {
  private readonly logger = new Logger(ContractorAuthService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly jwtService: JwtService,
  ) {}

  async register(
    dto: ContractorRegisterDto,
  ): Promise<{ access_token: string; user: Partial<User> }> {
    const email = dto.email.toLowerCase();

    // Duplicate check against unified users table
    const conn = this.em.getConnection();
    const dup = await conn.execute(
      `SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
      [email],
    );
    if (dup.length > 0) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const nameParts = dto.fullName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const user = this.em.create(User, {
      username: email,
      email,
      passwordHash,
      firstName,
      lastName,
      phone: dto.phone,
      isActive: true,
      status: 'ACTIVE',
      metadata: {
        userType: 'CONTRACTOR',
        companyName: dto.companyName,
        phone: dto.phone,
        position: dto.position,
        registeredAt: new Date().toISOString(),
        registrationSource: 'contractor-invite',
      },
    });
    await this.em.persistAndFlush(user);

    // Assign Contractor role
    const contractorRole = await this.em.findOne(
      Role,
      { name: 'Contractor' },
      { filters: false },
    );
    if (contractorRole) {
      const ur = this.em.create(UserRole, {
        userId: user.id,
        roleId: contractorRole.id,
        isSuperadmin: false,
      });
      await this.em.persistAndFlush(ur);
    } else {
      this.logger.warn(
        `CONTRACTOR_ROLE_MISSING: Contractor role not found; role not assigned for user ${user.id}`,
      );
    }

    if (dto.inviteToken) {
      await this.acceptInvite(dto.inviteToken, user.id).catch(() => {
        this.logger.warn(
          `Invite token accept failed during register for user ${user.id}`,
        );
      });
    }

    const token = this.signToken(user);
    this.logger.log(
      `CONTRACTOR_REGISTERED: id=${user.id}, email=${user.email}`,
    );
    return { access_token: token, user: this.sanitizeUser(user) };
  }

  async login(
    dto: ContractorLoginDto,
  ): Promise<{ access_token: string; contractor: Partial<ContractorUser> }> {
    const contractor = await this.em.findOne(ContractorUser, {
      email: dto.email.toLowerCase(),
    });
    if (!contractor || !contractor.passwordHash)
      throw new UnauthorizedException('Invalid credentials');
    if (!contractor.isActive)
      throw new UnauthorizedException('Account is deactivated');

    const valid = await bcrypt.compare(dto.password, contractor.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    contractor.lastLoginAt = new Date();
    await this.em.flush();

    // Legacy contractor_users login — kept for backward compat; new users authenticate via /api/auth/login
    const token = this.jwtService.sign({
      sub: contractor.id,
      email: contractor.email,
      roles: ['Contractor'],
      is_superadmin: false,
    });
    this.logger.log(`CONTRACTOR_LOGIN_LEGACY: id=${contractor.id}`);
    const { passwordHash: _pw, ...rest } = contractor as any;
    return { access_token: token, contractor: rest };
  }

  async generateInvite(
    projectId: string,
    createdById: string,
    dto: GenerateInviteDto,
  ): Promise<{ token: string; inviteUrl: string; expiresAt: Date }> {
    const tokenHex = crypto.randomBytes(32).toString('hex');
    const ttlHours = dto.ttlHours ?? 72;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const invite = this.em.create(ContractorInviteToken, {
      projectId,
      token: tokenHex,
      targetEmail: dto.targetEmail,
      createdBy: createdById,
      expiresAt,
    });
    await this.em.persistAndFlush(invite);

    this.logger.log(
      `CONTRACTOR_INVITE_GENERATED: project=${projectId}, by=${createdById}`,
    );
    return {
      token: tokenHex,
      inviteUrl: `/contractor/accept-invite?token=${tokenHex}`,
      expiresAt,
    };
  }

  async listInvites(projectId: string): Promise<ContractorInviteToken[]> {
    return this.em.find(
      ContractorInviteToken,
      { projectId },
      { orderBy: { createdAt: 'DESC' } },
    );
  }

  async revokeInvite(projectId: string, inviteId: string): Promise<void> {
    const invite = await this.em.findOne(ContractorInviteToken, {
      id: inviteId,
      projectId,
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status !== 'PENDING')
      throw new BadRequestException('Only PENDING invites can be revoked');
    invite.status = 'REVOKED';
    await this.em.flush();
  }

  async acceptInvite(
    token: string,
    userId: string,
  ): Promise<ProjectContractorAssignment> {
    const invite = await this.em.findOne(ContractorInviteToken, {
      token,
      status: 'PENDING',
    });
    if (!invite)
      throw new BadRequestException('Invalid or already-used invite token');
    if (invite.expiresAt < new Date()) {
      invite.status = 'EXPIRED';
      await this.em.flush();
      throw new BadRequestException('Invite token has expired');
    }

    const existing = await this.em.findOne(ProjectContractorAssignment, {
      projectId: invite.projectId,
      userId,
      removedAt: null,
    });
    if (existing)
      throw new ConflictException('Already assigned to this project');

    invite.status = 'ACCEPTED';
    invite.acceptedAt = new Date();
    invite.acceptedBy = userId;

    const assignment = this.em.create(ProjectContractorAssignment, {
      projectId: invite.projectId,
      userId,
      inviteTokenId: invite.id,
      assignedBy: invite.createdBy,
    });

    await this.em.persistAndFlush(assignment);
    this.logger.log(
      `CONTRACTOR_INVITE_ACCEPTED: project=${invite.projectId}, user=${userId}`,
    );
    return assignment;
  }

  async getProjectContractors(projectId: string): Promise<any[]> {
    const conn = this.em.getConnection();
    const rows = await conn.execute<any[]>(
      `SELECT pca.id, pca.role, pca.assigned_at, pca.removed_at,
              u.id AS contractor_id,
              CONCAT(u.first_name, ' ', u.last_name) AS full_name,
              u.email,
              u.metadata->>'companyName' AS company_name,
              u.metadata->>'position' AS position
       FROM project_contractor_assignments pca
       JOIN users u ON pca.user_id = u.id
       WHERE pca.project_id = ? AND pca.removed_at IS NULL
       ORDER BY pca.assigned_at DESC`,
      [projectId],
    );
    return rows;
  }

  async removeContractor(
    projectId: string,
    assignmentId: string,
  ): Promise<void> {
    const assignment = await this.em.findOne(ProjectContractorAssignment, {
      id: assignmentId,
      projectId,
      removedAt: null,
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    assignment.removedAt = new Date();
    await this.em.flush();
  }

  async deleteInvite(projectId: string, inviteId: string): Promise<void> {
    const invite = await this.em.findOne(ContractorInviteToken, {
      id: inviteId,
      projectId,
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status === 'PENDING')
      throw new BadRequestException('Revoke the invite before deleting it');
    await this.em.removeAndFlush(invite);
    this.logger.log(
      `CONTRACTOR_INVITE_DELETED: invite=${inviteId}, project=${projectId}`,
    );
  }

  async validateInvite(token: string): Promise<{
    inviteId: string;
    projectId: string;
    projectTitle: string;
    projectCampus: string;
    projectStatus: string;
    targetEmail: string | null;
    expiresAt: Date;
    createdByName: string;
    status: string;
  }> {
    const conn = this.em.getConnection();
    const rows = await conn.execute<any[]>(
      `SELECT
         cit.id AS invite_id, cit.project_id, cit.target_email, cit.expires_at, cit.status,
         cp.title AS project_title, cp.campus AS project_campus, cp.status AS project_status,
         CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
       FROM contractor_invite_tokens cit
       JOIN construction_projects cp ON cit.project_id = cp.id
       JOIN users u ON cit.created_by = u.id
       WHERE cit.token = ?`,
      [token],
    );

    if (!rows.length)
      throw new NotFoundException('Invite token not found or invalid');

    const row = rows[0];
    if (row.status === 'ACCEPTED')
      throw new BadRequestException('This invite has already been used');
    if (row.status === 'REVOKED')
      throw new BadRequestException(
        'This invite has been revoked by the administrator',
      );
    if (row.status === 'EXPIRED' || new Date(row.expires_at) < new Date()) {
      throw new BadRequestException('This invite has expired');
    }

    return {
      inviteId: row.invite_id,
      projectId: row.project_id,
      projectTitle: row.project_title,
      projectCampus: row.project_campus,
      projectStatus: row.project_status,
      targetEmail: row.target_email ?? null,
      expiresAt: row.expires_at,
      createdByName: row.created_by_name,
      status: row.status,
    };
  }

  async getAssignedProjects(userId: string): Promise<any[]> {
    const conn = this.em.getConnection();
    return conn.execute<any[]>(
      `SELECT cp.id, cp.title, cp.status, cp.campus, cp.physical_progress, pca.role, pca.assigned_at
       FROM project_contractor_assignments pca
       JOIN construction_projects cp ON pca.project_id = cp.id
       WHERE pca.user_id = ? AND pca.removed_at IS NULL AND cp.deleted_at IS NULL
       ORDER BY pca.assigned_at DESC`,
      [userId],
    );
  }

  private signToken(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      roles: ['Contractor'],
      is_superadmin: false,
    });
  }

  private sanitizeUser(u: User): Partial<User> {
    const { passwordHash: _pw, ...rest } = u as any;
    return rest;
  }
}
