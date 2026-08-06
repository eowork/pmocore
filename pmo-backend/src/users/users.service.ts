import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EntityManager } from '@mikro-orm/core';
import { createPaginatedResponse, PaginatedResponse } from '../common/dto';
import {
  CreateUserDto,
  UpdateUserDto,
  QueryUserDto,
  AssignRoleDto,
  SetPermissionOverrideDto,
  PermissionOverride,
  BulkPermissionUpdateDto,
  BulkPermissionResult,
  BulkCrossUserAccessDto,
  BulkCrossUserResult,
} from './dto';
import {
  User,
  Role,
  UserRole,
  UserPermissionOverride,
  UserModuleAssignment,
  UserPillarAssignment,
} from '../database/entities';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { ActivityAction } from '../activity-logs/activity-log.entity';
import { JwtPayload } from '../common/interfaces';

// Rank hierarchy constants (lower = higher authority)
export const RANK_LEVELS = {
  SUPER_ADMIN: 10,
  SENIOR_ADMIN: 20,
  MODULE_ADMIN: 30,
  SENIOR_STAFF: 50,
  JUNIOR_STAFF: 70,
  VIEWER: 100,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly SALT_ROUNDS = 12;
  // PHASE BBBB (BBBB-5b): default key applied when an admin accepts a password-reset request.
  static readonly DEFAULT_RESET_PASSWORD = '112233';
  private readonly ALLOWED_SORTS_MAP: Record<string, string> = {
    created_at: 'createdAt',
    email: 'email',
    first_name: 'firstName',
    last_name: 'lastName',
    is_active: 'isActive',
    rank_level: 'rankLevel',
  };

  constructor(
    private readonly em: EntityManager,
    private readonly activityLog: ActivityLogService,
  ) {}

  private async getActorRank(
    actorId: string,
  ): Promise<{ rank_level: number; is_superadmin: boolean }> {
    const user = await this.em.findOne(User, { id: actorId });
    if (!user) {
      return { rank_level: RANK_LEVELS.VIEWER, is_superadmin: false };
    }
    const superAdminRole = await this.em.findOne(UserRole, {
      userId: actorId,
      isSuperadmin: true,
    });
    return {
      rank_level: user.rankLevel ?? RANK_LEVELS.VIEWER,
      is_superadmin: !!superAdminRole,
    };
  }

  private async canModifyUser(
    actorId: string,
    targetId: string,
  ): Promise<boolean> {
    const conn = this.em.getConnection();
    const result = await conn.execute(
      'SELECT can_modify_user(?, ?) as can_modify',
      [actorId, targetId],
    );
    return result[0]?.can_modify === true;
  }

  private async validateRankAssignment(
    actorId: string,
    targetRank: number,
  ): Promise<void> {
    const actor = await this.getActorRank(actorId);
    if (actor.is_superadmin) return;
    if (targetRank <= actor.rank_level) {
      throw new ForbiddenException(
        `Cannot assign rank ${targetRank}. You can only assign ranks lower than your own (>${actor.rank_level}).`,
      );
    }
  }

  async findAll(query: QueryUserDto): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20, sort = 'created_at', order = 'desc' } = query;
    const offset = (page - 1) * limit;

    const sortProp = this.ALLOWED_SORTS_MAP[sort] || 'createdAt';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conn = this.em.getConnection();
    const conditions: string[] = ['u.deleted_at IS NULL'];
    const params: any[] = [];

    if (query.is_active !== undefined) {
      conditions.push('u.is_active = ?');
      params.push(query.is_active);
    }

    if (query.search) {
      conditions.push(
        '(u.email ILIKE ? OR u.first_name ILIKE ? OR u.last_name ILIKE ?)',
      );
      const pat = `%${query.search}%`;
      params.push(pat, pat, pat);
    }

    if (query.role) {
      conditions.push(
        'EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = u.id AND r.name = ?)',
      );
      params.push(query.role);
    }

    if (query.campus) {
      conditions.push('u.campus = ?');
      params.push(query.campus);
    }

    // PQ-D: filter by registration status
    if (query.status) {
      conditions.push('u.status = ?');
      params.push(query.status);
    }

    // PJ-G: filter by userType from metadata JSONB
    if (query.user_type) {
      conditions.push(`u.metadata->>'userType' = ?`);
      params.push(query.user_type);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await conn.execute(
      `SELECT COUNT(*) FROM users u WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult[0].count, 10);

    // Map camelCase prop back to snake_case column for ORDER BY
    const sortColumnMap: Record<string, string> = {
      createdAt: 'created_at',
      email: 'email',
      firstName: 'first_name',
      lastName: 'last_name',
      isActive: 'is_active',
      rankLevel: 'rank_level',
    };
    const sortColumn = sortColumnMap[sortProp] || 'created_at';

    const dataResult = await conn.execute(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
              u.is_active, u.last_login_at, u.rank_level, u.campus, u.created_at, u.updated_at,
              u.status, u.metadata,
              (SELECT COUNT(*)::int FROM project_contractor_assignments pca
               WHERE pca.user_id = u.id AND pca.removed_at IS NULL) AS project_assignment_count,
              COALESCE(
                (SELECT json_agg(json_build_object('id', r.id, 'name', r.name, 'is_superadmin', ur.is_superadmin))
                 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                 WHERE ur.user_id = u.id),
                '[]'
              ) as roles
       FROM users u
       WHERE ${whereClause}
       ORDER BY u.${sortColumn} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return createPaginatedResponse(dataResult, total, page, limit);
  }

  private normalizeRecordCampusToUserCampus(
    recordCampus?: string,
  ): string | null {
    if (!recordCampus || recordCampus === 'BOTH') return null;
    if (recordCampus === 'MAIN') return 'Butuan Campus';
    if (recordCampus === 'CABADBARAN') return 'Cabadbaran';
    return null;
  }

  async findEligibleForAssignment(): Promise<any[]> {
    // ZB-1: Return all active users regardless of role — external personnel
    // (Contractor, Consultant, etc.) must appear alongside institutional staff.
    const conn = this.em.getConnection();
    const result = await conn.execute(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.campus
       FROM users u
       WHERE u.deleted_at IS NULL
         AND u.is_active = true
       ORDER BY u.last_name, u.first_name`,
      [],
    );
    return result;
  }

  // QE-A: Returns users with Contractor role — used by CiPersonnelAccessCard Quick Assign feature
  async findEligibleContractors(): Promise<any[]> {
    const conn = this.em.getConnection();
    return conn.execute(
      `SELECT u.id, u.first_name, u.last_name, u.email,
              u.campus, u.metadata->>'companyName' as company_name,
              u.metadata->>'position' as position,
              (SELECT COUNT(*)::int FROM record_assignments ra
               WHERE ra.user_id = u.id AND ra.module = 'CONSTRUCTION') as assignment_count
       FROM users u
       WHERE u.deleted_at IS NULL AND u.is_active = true
         AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                     WHERE ur.user_id = u.id AND r.name = 'Contractor')
       ORDER BY u.last_name, u.first_name`,
      [],
    );
  }

  async findOne(id: string): Promise<any> {
    const user = await this.em.findOne(User, { id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Roles with is_superadmin flag
    const userRoles = await this.em.find(UserRole, { userId: id });
    const roleIds = userRoles.map((ur) => ur.roleId);
    const roleEntities =
      roleIds.length > 0
        ? await this.em.find(Role, { id: { $in: roleIds } })
        : [];
    const roleById = new Map(roleEntities.map((r) => [r.id, r]));
    const roles = userRoles.map((ur) => ({
      id: ur.roleId,
      name: roleById.get(ur.roleId)?.name || '',
      is_superadmin: ur.isSuperadmin,
      assigned_at: ur.assignedAt,
    }));

    // Permissions (hybrid raw for DISTINCT across JOIN chain)
    const conn = this.em.getConnection();
    const permsResult = await conn.execute(
      `SELECT DISTINCT p.id, p.name, p.resource, p.action
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = ?`,
      [id],
    );

    // PHASE BBCH (Track 2, R-373): surface effective module grants (from approved access requests
    // → user_permission_overrides) so the detail page can show the access level per module, not
    // just role-derived permission strings. module_overrides = access flag; module_levels = CRUD tier.
    const overrides = await this.em.find(UserPermissionOverride, {
      userId: id,
    });
    const module_overrides = overrides.reduce(
      (acc, o) => {
        acc[o.moduleKey] = o.canAccess;
        return acc;
      },
      {} as Record<string, boolean>,
    );
    const module_levels = overrides.reduce(
      (acc, o) => {
        if (o.canAccess && o.grantedLevel) acc[o.moduleKey] = o.grantedLevel;
        return acc;
      },
      {} as Record<string, string>,
    );

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      first_name: user.firstName,
      middle_name: user.middleName,
      last_name: user.lastName,
      phone: user.phone,
      avatar_url: user.avatarUrl,
      is_active: user.isActive,
      last_login_at: user.lastLoginAt,
      last_password_change_at: user.lastPasswordChangeAt,
      failed_login_attempts: user.failedLoginAttempts,
      account_locked_until: user.accountLockedUntil,
      rank_level: user.rankLevel,
      campus: user.campus,
      metadata: user.metadata,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      roles,
      permissions: permsResult,
      module_overrides,
      module_levels,
    };
  }

  async create(dto: CreateUserDto, adminId: string): Promise<any> {
    // Duplicate email check
    const existingEmail = await this.em.findOne(User, { email: dto.email });
    if (existingEmail) {
      throw new ConflictException(
        `User with email ${dto.email} already exists`,
      );
    }

    // Duplicate username (case-insensitive)
    const existingUsername = await this.em.findOne(User, {
      username: { $ilike: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException(
        `User with username ${dto.username} already exists`,
      );
    }

    const targetRank =
      dto.rank_level !== undefined ? dto.rank_level : RANK_LEVELS.VIEWER;
    await this.validateRankAssignment(adminId, targetRank);

    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    const user = this.em.create(User, {
      email: dto.email,
      username: dto.username.toLowerCase(),
      passwordHash,
      firstName: dto.first_name,
      lastName: dto.last_name,
      phone: dto.phone || undefined,
      avatarUrl: dto.avatar_url || undefined,
      isActive: dto.is_active !== undefined ? dto.is_active : true,
      rankLevel: targetRank,
      campus: dto.campus || undefined,
      metadata: dto.metadata || undefined,
    });
    await this.em.persistAndFlush(user);

    this.logger.log(
      `USER_CREATED: id=${user.id}, email=${dto.email}, rank=${targetRank}, by=${adminId}`,
    );
    // PHASE BBBG (Track 4): audit user creation.
    void this.activityLog.logAction(
      { sub: adminId, email: '', roles: [], is_superadmin: false },
      ActivityAction.USER_CREATED,
      'user',
      user.id,
      { email: dto.email, rank_level: targetRank },
    );

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      first_name: user.firstName,
      last_name: user.lastName,
      phone: user.phone,
      avatar_url: user.avatarUrl,
      is_active: user.isActive,
      rank_level: user.rankLevel,
      campus: user.campus,
      created_at: user.createdAt,
    };
  }

  async update(id: string, dto: UpdateUserDto, adminId: string): Promise<any> {
    const existing = await this.em.findOne(User, { id });
    if (!existing) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // PHASE BBBG (Track 4): capture pre-state so rank / status changes can be audited distinctly.
    const prevRank = existing.rankLevel;
    const prevActive = existing.isActive;

    // Self-edit vs admin-edit check
    if (id === adminId) {
      const forbiddenFields: string[] = [];
      if (dto.username !== undefined) forbiddenFields.push('username');
      if (dto.email !== undefined) forbiddenFields.push('email');
      if (dto.password !== undefined) forbiddenFields.push('password');
      if (dto.rank_level !== undefined) forbiddenFields.push('rank_level');
      if (dto.is_active !== undefined) forbiddenFields.push('is_active');
      if (dto.metadata !== undefined) forbiddenFields.push('metadata');
      if ((dto as any).campus !== undefined) forbiddenFields.push('campus');

      if (forbiddenFields.length > 0) {
        throw new ForbiddenException(
          `Cannot self-edit: ${forbiddenFields.join(', ')}. Admin approval required for username, email, rank, or password changes.`,
        );
      }
    } else {
      const canModify = await this.canModifyUser(adminId, id);
      if (!canModify) {
        throw new ForbiddenException(
          'Cannot modify a user with equal or higher authority',
        );
      }
    }

    if (dto.first_name !== undefined) existing.firstName = dto.first_name;
    if (dto.last_name !== undefined) existing.lastName = dto.last_name;

    if (dto.username !== undefined) {
      const dup = await this.em.findOne(User, {
        username: dto.username,
        id: { $ne: id },
      });
      if (dup) throw new ConflictException('Username already exists');
      this.logger.log({
        action: 'USER_USERNAME_CHANGED',
        userId: id,
        oldValue: existing.username,
        newValue: dto.username,
        actorId: adminId,
        timestamp: new Date().toISOString(),
      });
      existing.username = dto.username;
    }

    if (dto.email !== undefined) {
      const dup = await this.em.findOne(User, {
        email: dto.email,
        id: { $ne: id },
      });
      if (dup) throw new ConflictException('Email already exists');
      this.logger.log({
        action: 'USER_EMAIL_CHANGED',
        userId: id,
        oldValue: existing.email,
        newValue: dto.email,
        actorId: adminId,
        timestamp: new Date().toISOString(),
      });
      existing.email = dto.email;
    }

    if (dto.phone !== undefined) existing.phone = dto.phone;
    if (dto.avatar_url !== undefined) existing.avatarUrl = dto.avatar_url;
    if (dto.is_active !== undefined) existing.isActive = dto.is_active;
    if (dto.metadata !== undefined) existing.metadata = dto.metadata as any;

    // PHASE BBBG (Track 5): grouped-profile fields. middle_name is a column; office/position/
    // suffix live in metadata (merged, not replaced) so no schema migration is needed.
    if ((dto as any).middle_name !== undefined) {
      existing.middleName = (dto as any).middle_name || undefined;
    }
    const metaFields = ['office', 'position', 'suffix'] as const;
    if (metaFields.some((f) => (dto as any)[f] !== undefined)) {
      const merged = { ...(existing.metadata || {}) };
      for (const f of metaFields) {
        if ((dto as any)[f] !== undefined) {
          const v = ((dto as any)[f] as string)?.trim();
          if (v) merged[f] = v;
          else delete merged[f];
        }
      }
      existing.metadata = merged as any;
    }

    if (dto.password) {
      existing.passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
      existing.lastPasswordChangeAt = new Date();
    }

    if (dto.rank_level !== undefined) {
      await this.validateRankAssignment(adminId, dto.rank_level);
      existing.rankLevel = dto.rank_level;
    }

    if ((dto as any).campus !== undefined) {
      existing.campus = (dto as any).campus;
    }

    existing.updatedBy = adminId;
    await this.em.flush();

    this.logger.log(`USER_UPDATED: id=${id}, by=${adminId}`);

    // PHASE BBBG (Track 4): audit the update plus distinct rank / account-status events.
    const actor = { sub: adminId, email: '', roles: [], is_superadmin: false };
    void this.activityLog.logAction(
      actor,
      ActivityAction.USER_UPDATED,
      'user',
      id,
    );
    if (dto.rank_level !== undefined && dto.rank_level !== prevRank) {
      void this.activityLog.logAction(
        actor,
        ActivityAction.RANK_CHANGED,
        'user',
        id,
        {
          from: prevRank,
          to: dto.rank_level,
        },
      );
    }
    if (dto.is_active !== undefined && dto.is_active !== prevActive) {
      void this.activityLog.logAction(
        actor,
        dto.is_active
          ? ActivityAction.ACCOUNT_ENABLED
          : ActivityAction.ACCOUNT_DISABLED,
        'user',
        id,
      );
    }

    return {
      id: existing.id,
      email: existing.email,
      first_name: existing.firstName,
      last_name: existing.lastName,
      phone: existing.phone,
      avatar_url: existing.avatarUrl,
      is_active: existing.isActive,
      rank_level: existing.rankLevel,
      campus: existing.campus,
      updated_at: existing.updatedAt,
    };
  }

  async remove(id: string, adminId: string): Promise<void> {
    const canModify = await this.canModifyUser(adminId, id);
    if (!canModify) {
      throw new ForbiddenException(
        'Cannot delete a user with equal or higher authority',
      );
    }
    if (id === adminId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const user = await this.em.findOne(User, { id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    user.deletedAt = new Date();
    user.deletedBy = adminId;
    await this.em.flush();

    this.logger.log(`USER_DELETED: id=${id}, by=${adminId}`);
  }

  // --- Role Management ---

  async assignRole(
    userId: string,
    dto: AssignRoleDto,
    adminId: string,
  ): Promise<any> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (userId !== adminId) {
      const canModify = await this.canModifyUser(adminId, userId);
      if (!canModify) {
        throw new ForbiddenException(
          'Cannot modify roles of a user with equal or higher authority',
        );
      }
    }

    const role = await this.em.findOne(Role, { id: dto.role_id });
    if (!role) {
      throw new NotFoundException(`Role with ID ${dto.role_id} not found`);
    }

    if (dto.is_superadmin === true && userId === adminId) {
      throw new BadRequestException(
        'Cannot assign SuperAdmin status to yourself',
      );
    }

    if (dto.is_superadmin === true) {
      const adminIsSuperAdmin = await this.em.findOne(UserRole, {
        userId: adminId,
        isSuperadmin: true,
      });
      if (!adminIsSuperAdmin) {
        throw new BadRequestException(
          'Only a SuperAdmin can assign SuperAdmin status',
        );
      }
    }

    const existing = await this.em.findOne(UserRole, {
      userId,
      roleId: dto.role_id,
    });

    if (existing) {
      if (dto.is_superadmin !== undefined) {
        existing.isSuperadmin = dto.is_superadmin;
        await this.em.flush();
      }
      this.logger.log(
        `USER_ROLE_UPDATED: user=${userId}, role=${dto.role_id}, superadmin=${dto.is_superadmin}, by=${adminId}`,
      );
    } else {
      const ur = this.em.create(UserRole, {
        userId,
        roleId: dto.role_id,
        isSuperadmin: dto.is_superadmin || false,
        assignedBy: adminId,
        createdBy: adminId,
      });
      await this.em.persistAndFlush(ur);
      this.logger.log(
        `USER_ROLE_ASSIGNED: user=${userId}, role=${dto.role_id}, superadmin=${dto.is_superadmin}, by=${adminId}`,
      );
    }

    void this.activityLog.logAction(
      { sub: adminId, email: '', roles: [], is_superadmin: false },
      ActivityAction.ROLE_ASSIGN,
      'user',
      userId,
      { role_id: dto.role_id, is_superadmin: dto.is_superadmin },
    );

    return this.findOne(userId);
  }

  async removeRole(
    userId: string,
    roleId: string,
    adminId: string,
  ): Promise<any> {
    if (userId !== adminId) {
      const canModify = await this.canModifyUser(adminId, userId);
      if (!canModify) {
        throw new ForbiddenException(
          'Cannot modify roles of a user with equal or higher authority',
        );
      }
    }

    const targetRole = await this.em.findOne(UserRole, { userId, roleId });
    if (!targetRole) {
      throw new NotFoundException(`Role assignment not found`);
    }

    if (targetRole.isSuperadmin) {
      const count = await this.em.count(UserRole, { isSuperadmin: true });
      if (count <= 1) {
        throw new BadRequestException(
          'Cannot remove the last SuperAdmin. Assign another SuperAdmin first.',
        );
      }
    }

    const deleted = await this.em.nativeDelete(UserRole, { userId, roleId });
    if (deleted === 0) {
      throw new NotFoundException(`Role assignment not found`);
    }

    this.logger.log(
      `USER_ROLE_REMOVED: user=${userId}, role=${roleId}, by=${adminId}`,
    );
    return this.findOne(userId);
  }

  async getRoles(): Promise<any[]> {
    const roles = await this.em.find(Role, {}, { orderBy: { name: 'ASC' } });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
    }));
  }

  // --- Account Management ---

  async unlockAccount(userId: string, adminId: string): Promise<any> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.failedLoginAttempts = 0;
    user.accountLockedUntil = undefined;
    await this.em.flush();

    this.logger.log(`USER_ACCOUNT_UNLOCKED: id=${userId}, by=${adminId}`);

    return {
      id: user.id,
      email: user.email,
      failed_login_attempts: user.failedLoginAttempts,
      account_locked_until: user.accountLockedUntil,
    };
  }

  async resetPassword(
    userId: string,
    newPassword: string,
    adminId: string,
  ): Promise<void> {
    if (userId === adminId) {
      throw new ForbiddenException(
        'Cannot bypass password complexity for your own account. Use profile settings to change your password with complexity requirements.',
      );
    }

    const canModify = await this.canModifyUser(adminId, userId);
    if (!canModify) {
      throw new ForbiddenException(
        'Cannot reset password for a user with equal or higher authority',
      );
    }

    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    user.lastPasswordChangeAt = new Date();
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = undefined;
    await this.em.flush();

    this.logger.log({
      action: 'USER_PASSWORD_RESET',
      userId,
      actorId: adminId,
      bypass_complexity: true,
      timestamp: new Date().toISOString(),
    });
  }

  // --- Permission Overrides ---

  async getPermissionOverrides(userId: string): Promise<PermissionOverride[]> {
    const overrides = await this.em.find(
      UserPermissionOverride,
      { userId },
      { orderBy: { moduleKey: 'ASC' } },
    );
    return overrides.map((o) => ({
      id: o.id,
      user_id: o.userId,
      module_key: o.moduleKey,
      can_access: o.canAccess,
      granted_level: o.grantedLevel ?? null,
      created_at: o.createdAt,
      updated_at: o.updatedAt,
    })) as PermissionOverride[];
  }

  async setPermissionOverride(
    userId: string,
    dto: SetPermissionOverrideDto,
    adminId: string,
  ): Promise<PermissionOverride> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (userId !== adminId) {
      const canModify = await this.canModifyUser(adminId, userId);
      if (!canModify) {
        throw new ForbiddenException(
          'Cannot modify permissions of a user with equal or higher authority',
        );
      }
    }

    let override = await this.em.findOne(UserPermissionOverride, {
      userId,
      moduleKey: dto.module_key,
    });
    if (override) {
      override.canAccess = dto.can_access;
      // PHASE BBBC (Track 8a): set the level when provided; otherwise, on a fresh grant with no
      // level yet, default to view-only (Viewer) — CRUD must be granted explicitly.
      if (dto.granted_level) {
        override.grantedLevel = dto.granted_level;
      } else if (dto.can_access && !override.grantedLevel) {
        override.grantedLevel = 'Viewer';
      }
      override.updatedBy = adminId;
    } else {
      override = this.em.create(UserPermissionOverride, {
        userId,
        moduleKey: dto.module_key,
        canAccess: dto.can_access,
        grantedLevel:
          dto.granted_level ?? (dto.can_access ? 'Viewer' : undefined),
        createdBy: adminId,
        updatedBy: adminId,
      });
      this.em.persist(override);
    }
    await this.em.flush();

    this.logger.log(
      `PERMISSION_OVERRIDE_SET: user=${userId}, module=${dto.module_key}, access=${dto.can_access}, by=${adminId}`,
    );
    // PHASE BBBG (Track 4): audit per-module access changes.
    void this.activityLog.logAction(
      { sub: adminId, email: '', roles: [], is_superadmin: false },
      ActivityAction.MODULE_ACCESS_CHANGED,
      'user',
      userId,
      {
        module_key: dto.module_key,
        can_access: dto.can_access,
        granted_level: override.grantedLevel ?? null,
      },
    );

    return {
      id: override.id,
      user_id: override.userId,
      module_key: override.moduleKey,
      can_access: override.canAccess,
      granted_level: override.grantedLevel ?? null,
      created_at: override.createdAt,
      updated_at: override.updatedAt,
    } as PermissionOverride;
  }

  async removePermissionOverride(
    userId: string,
    moduleKey: string,
    adminId: string,
  ): Promise<void> {
    if (userId !== adminId) {
      const canModify = await this.canModifyUser(adminId, userId);
      if (!canModify) {
        throw new ForbiddenException(
          'Cannot modify permissions of a user with equal or higher authority',
        );
      }
    }

    const deleted = await this.em.nativeDelete(UserPermissionOverride, {
      userId,
      moduleKey,
    });
    if (deleted === 0) {
      throw new NotFoundException(
        `Permission override not found for user ${userId} and module ${moduleKey}`,
      );
    }

    this.logger.log(
      `PERMISSION_OVERRIDE_REMOVED: user=${userId}, module=${moduleKey}, by=${adminId}`,
    );
    // PHASE BBBG (Track 4): audit module-access removal.
    void this.activityLog.logAction(
      { sub: adminId, email: '', roles: [], is_superadmin: false },
      ActivityAction.MODULE_ACCESS_CHANGED,
      'user',
      userId,
      { module_key: moduleKey, can_access: false, removed: true },
    );
  }

  async bulkUpdatePermissions(
    userId: string,
    dto: BulkPermissionUpdateDto,
    adminId: string,
  ): Promise<BulkPermissionResult> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (userId !== adminId) {
      const canModify = await this.canModifyUser(adminId, userId);
      if (!canModify) {
        throw new ForbiddenException(
          'Cannot modify permissions of a user with equal or higher authority',
        );
      }
    }

    if (!dto.updates || dto.updates.length === 0) {
      throw new BadRequestException('Updates array cannot be empty');
    }

    const isRevokingOwnUsersAccess =
      userId === adminId &&
      dto.updates.some(
        (u) => u.module_key === 'users' && u.can_access === false,
      );
    if (isRevokingOwnUsersAccess) {
      throw new ForbiddenException(
        'Cannot revoke your own access to User Management',
      );
    }

    const isRevokingUsersAccess = dto.updates.some(
      (u) => u.module_key === 'users' && u.can_access === false,
    );
    if (isRevokingUsersAccess) {
      const conn = this.em.getConnection();
      const r = await conn.execute(
        `SELECT COUNT(DISTINCT u.id) as count
         FROM users u
         JOIN user_roles ur ON u.id = ur.user_id
         JOIN roles r ON ur.role_id = r.id
         WHERE u.deleted_at IS NULL
           AND u.is_active = TRUE
           AND u.id != ?
           AND (r.name = 'Admin' OR ur.is_superadmin = TRUE)`,
        [userId],
      );
      const remainingAdmins = parseInt(r[0].count, 10);
      if (remainingAdmins === 0) {
        throw new ForbiddenException(
          'Cannot remove the last administrator from User Management',
        );
      }
    }

    let updatedCount = 0;
    let deletedCount = 0;

    await this.em.transactional(async (em) => {
      for (const update of dto.updates) {
        if (update.can_access === null) {
          const d = await em.nativeDelete(UserPermissionOverride, {
            userId,
            moduleKey: update.module_key,
          });
          if (d > 0) deletedCount++;
        } else {
          let ovr = await em.findOne(UserPermissionOverride, {
            userId,
            moduleKey: update.module_key,
          });
          if (ovr) {
            ovr.canAccess = update.can_access;
            ovr.updatedBy = adminId;
          } else {
            ovr = em.create(UserPermissionOverride, {
              userId,
              moduleKey: update.module_key,
              canAccess: update.can_access,
              createdBy: adminId,
              updatedBy: adminId,
            });
            em.persist(ovr);
          }
          updatedCount++;
        }
      }
    });

    this.logger.log(
      `BULK_PERMISSION_UPDATE: user=${userId}, updated=${updatedCount}, deleted=${deletedCount}, by=${adminId}`,
    );

    return {
      success: true,
      updated: updatedCount,
      deleted: deletedCount,
    };
  }

  // ============================================================
  // MODULE ASSIGNMENT MANAGEMENT
  // ============================================================

  async getModuleAssignments(userId: string): Promise<any[]> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const conn = this.em.getConnection();
    const result = await conn.execute(
      `SELECT uma.id, uma.user_id, uma.module, uma.assigned_by, uma.assigned_at,
              u.email as assigned_by_email
       FROM user_module_assignments uma
       LEFT JOIN users u ON uma.assigned_by = u.id
       WHERE uma.user_id = ?
       ORDER BY uma.module`,
      [userId],
    );
    return result;
  }

  async assignModule(
    userId: string,
    module: string,
    adminId: string,
  ): Promise<any> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const validModules = ['CONSTRUCTION', 'REPAIR', 'OPERATIONS', 'ALL'];
    if (!validModules.includes(module)) {
      throw new BadRequestException(`Invalid module type: ${module}`);
    }

    const existing = await this.em.findOne(UserModuleAssignment, {
      userId,
      module: module as any,
    });
    if (existing) {
      throw new ConflictException(`User already has ${module} module assigned`);
    }

    if (module === 'ALL') {
      await this.em.nativeDelete(UserModuleAssignment, {
        userId,
        module: { $ne: 'ALL' as any },
      });
    }

    if (module !== 'ALL') {
      const hasAll = await this.em.findOne(UserModuleAssignment, {
        userId,
        module: 'ALL' as any,
      });
      if (hasAll) {
        throw new ConflictException('User already has ALL modules assigned');
      }
    }

    const entity = this.em.create(UserModuleAssignment, {
      userId,
      module: module as any,
      assignedBy: adminId,
    });
    await this.em.persistAndFlush(entity);

    this.logger.log(
      `MODULE_ASSIGN: user=${userId}, module=${module}, by=${adminId}`,
    );

    return {
      id: entity.id,
      user_id: entity.userId,
      module: entity.module,
      assigned_by: entity.assignedBy,
      assigned_at: entity.assignedAt,
    };
  }

  async removeModuleAssignment(
    userId: string,
    module: string,
    adminId: string,
  ): Promise<void> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const deleted = await this.em.nativeDelete(UserModuleAssignment, {
      userId,
      module: module as any,
    });
    if (deleted === 0) {
      throw new NotFoundException(`Module assignment not found: ${module}`);
    }

    this.logger.log(
      `MODULE_UNASSIGN: user=${userId}, module=${module}, by=${adminId}`,
    );
  }

  async bulkUpdateModuleAssignments(
    userId: string,
    modules: string[],
    adminId: string,
  ): Promise<{ success: boolean; assigned: string[] }> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const validModules = ['CONSTRUCTION', 'REPAIR', 'OPERATIONS', 'ALL'];
    for (const m of modules) {
      if (!validModules.includes(m)) {
        throw new BadRequestException(`Invalid module type: ${m}`);
      }
    }

    const finalModules = modules.includes('ALL') ? ['ALL'] : modules;

    await this.em.transactional(async (em) => {
      await em.nativeDelete(UserModuleAssignment, { userId });
      for (const m of finalModules) {
        const entity = em.create(UserModuleAssignment, {
          userId,
          module: m as any,
          assignedBy: adminId,
        });
        em.persist(entity);
      }
    });

    this.logger.log(
      `BULK_MODULE_UPDATE: user=${userId}, modules=[${finalModules.join(',')}], by=${adminId}`,
    );

    return { success: true, assigned: finalModules };
  }

  // --- Pillar Assignments ---

  async getPillarAssignments(userId: string): Promise<string[]> {
    const pillars = await this.em.find(
      UserPillarAssignment,
      { userId },
      { orderBy: { pillarType: 'ASC' } },
    );
    return pillars.map((p) => p.pillarType);
  }

  async assignPillar(
    userId: string,
    pillarType: string,
    actorId: string,
  ): Promise<{ pillar_type: string }> {
    const valid = [
      'HIGHER_EDUCATION',
      'ADVANCED_EDUCATION',
      'RESEARCH',
      'TECHNICAL_ADVISORY',
    ];
    if (!valid.includes(pillarType)) {
      throw new BadRequestException(`Invalid pillar_type: ${pillarType}`);
    }

    const existing = await this.em.findOne(UserPillarAssignment, {
      userId,
      pillarType,
    });
    if (!existing) {
      const entity = this.em.create(UserPillarAssignment, {
        userId,
        pillarType,
        assignedBy: actorId,
      });
      await this.em.persistAndFlush(entity);
    }

    this.logger.log(
      `PILLAR_ASSIGNED: user=${userId}, pillar=${pillarType}, by=${actorId}`,
    );
    return { pillar_type: pillarType };
  }

  async revokePillar(
    userId: string,
    pillarType: string,
    actorId: string,
  ): Promise<void> {
    await this.em.nativeDelete(UserPillarAssignment, { userId, pillarType });
    this.logger.log(
      `PILLAR_REVOKED: user=${userId}, pillar=${pillarType}, by=${actorId}`,
    );
  }

  // --- Password Reset Requests ---

  // PQ-D: Admin activates a self-registered PENDING user
  async activateUser(id: string, adminId: string): Promise<void> {
    const conn = this.em.getConnection();
    const result = await conn.execute(
      `UPDATE users SET status = 'ACTIVE', is_active = true, updated_by = ?, updated_at = NOW()
       WHERE id = ? AND status = 'PENDING' AND deleted_at IS NULL`,
      [adminId, id],
    );
    if (!result || (result as any).rowCount === 0) {
      throw new Error('User not found or not in PENDING status');
    }
    this.logger.log(`USER_ACTIVATED: id=${id}, by=${adminId}`);
    // PHASE BBBG (Track 4): audit account enable (PENDING → ACTIVE).
    void this.activityLog.logAction(
      { sub: adminId, email: '', roles: [], is_superadmin: false },
      ActivityAction.ACCOUNT_ENABLED,
      'user',
      id,
      { from_status: 'PENDING' },
    );

    // ZJ-1: Assign default 'Staff' role if user has no roles after activation.
    // user_roles has composite PK (user_id, role_id) — no id or updated_at column.
    const existingRoles = await conn.execute(
      `SELECT user_id FROM user_roles WHERE user_id = ? LIMIT 1`,
      [id],
    );
    if (existingRoles.length === 0) {
      const staffRole = await conn.execute(
        `SELECT id FROM roles WHERE name = 'Staff' AND deleted_at IS NULL LIMIT 1`,
        [],
      );
      if (staffRole.length > 0) {
        await conn.execute(
          `INSERT INTO user_roles (user_id, role_id, is_superadmin, assigned_by, created_at)
           VALUES (?, ?, false, ?, NOW())
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [id, staffRole[0].id, adminId],
        );
        this.logger.log(
          `USER_DEFAULT_ROLE_ASSIGNED: user=${id}, role=Staff, by=${adminId}`,
        );
      }
    }
  }

  // PQ-D: Admin rejects a self-registered PENDING user
  async rejectRegistration(id: string, adminId: string): Promise<void> {
    const conn = this.em.getConnection();
    await conn.execute(
      `UPDATE users SET status = 'REJECTED', is_active = false, updated_by = ?, updated_at = NOW()
       WHERE id = ? AND status = 'PENDING' AND deleted_at IS NULL`,
      [adminId, id],
    );
    this.logger.log(`REGISTRATION_REJECTED: id=${id}, by=${adminId}`);
    // PHASE BBBG (Track 4): audit account disable (registration rejection).
    void this.activityLog.logAction(
      { sub: adminId, email: '', roles: [], is_superadmin: false },
      ActivityAction.ACCOUNT_DISABLED,
      'user',
      id,
      { reason: 'REGISTRATION_REJECTED' },
    );
  }

  // PHASE BBBG (Track 3): optional status filter so reset history (COMPLETED) stays auditable.
  // Default (no status) preserves prior behaviour — pending queue only.
  async getPasswordResetRequests(status?: string): Promise<any[]> {
    const conn = this.em.getConnection();
    const base = `SELECT id, identifier, status, notes, requested_at, completed_by, completed_at
       FROM password_reset_requests`;
    if (status && status !== 'ALL') {
      return conn.execute(
        `${base} WHERE status = ? ORDER BY requested_at DESC`,
        [status],
      );
    }
    if (status === 'ALL') {
      return conn.execute(`${base} ORDER BY requested_at DESC`, []);
    }
    return conn.execute(
      `${base} WHERE status = 'PENDING' ORDER BY requested_at DESC`,
      [],
    );
  }

  // PHASE BBBB (BBBB-5a/5b): accepting a reset request now (a) resets the user's password to the
  // default key, (b) marks the request COMPLETED, and (c) returns JSON (fixes the prior 200+void
  // body that made useApi throw "Invalid response format"). If the identifier matches no active
  // user, the request is still CLOSED (operator decision) — reset=false.
  async completePasswordResetRequest(
    requestId: string,
    actor: JwtPayload,
  ): Promise<{
    message: string;
    default_password: string | null;
    reset: boolean;
  }> {
    const adminId = actor.sub;
    const conn = this.em.getConnection();

    // Fetch the request to obtain the identifier (email or username).
    const rows = await conn.execute(
      `SELECT identifier, status FROM password_reset_requests WHERE id = ?`,
      [requestId],
    );
    if (rows.length === 0) {
      throw new NotFoundException(`Reset request ${requestId} not found`);
    }

    const identifier: string = rows[0].identifier;
    const user = await this.em.findOne(User, {
      $or: [
        { email: { $ilike: identifier } },
        { username: { $ilike: identifier } },
      ],
    });

    let reset = false;
    if (user && user.isActive) {
      // Rank guard, consistent with resetPassword.
      const canModify = await this.canModifyUser(adminId, user.id);
      if (!canModify) {
        throw new ForbiddenException(
          'Cannot reset password for a user with equal or higher authority',
        );
      }
      user.passwordHash = await bcrypt.hash(
        UsersService.DEFAULT_RESET_PASSWORD,
        this.SALT_ROUNDS,
      );
      user.lastPasswordChangeAt = new Date();
      user.failedLoginAttempts = 0;
      user.accountLockedUntil = undefined;
      // PHASE BBBC (Track 4): force the user to replace the default key at next login.
      user.mustChangePassword = true;
      await this.em.flush();
      reset = true;
    }

    // Close the request regardless (per operator decision).
    await conn.execute(
      `UPDATE password_reset_requests
       SET status = 'COMPLETED', completed_by = ?, completed_at = NOW()
       WHERE id = ? AND status = 'PENDING'`,
      [adminId, requestId],
    );

    this.logger.log(
      `PASSWORD_RESET_COMPLETED: request=${requestId}, by=${adminId}, identifier=${identifier}, reset=${reset}`,
    );
    // PHASE BBCH (Track 5, R-375/R-376): dedicated COMPLETED action + real actor email.
    void this.activityLog.logAction(
      actor,
      ActivityAction.PASSWORD_RESET_COMPLETED,
      'user',
      user?.id ?? requestId,
      { identifier, reset },
    );

    return reset
      ? {
          message: `Password reset to the default key. Share it with the user and ask them to change it.`,
          default_password: UsersService.DEFAULT_RESET_PASSWORD,
          reset: true,
        }
      : {
          message: `Request closed — no active account matched "${identifier}". No password was changed.`,
          default_password: null,
          reset: false,
        };
  }

  // PHASE BBCH (Track 5, R-375): deny a pending reset request without changing any password —
  // preserves history (PENDING → DENIED) and audits the decision. Mirrors the access-request
  // lifecycle so admins can dismiss illegitimate reset requests instead of completing them.
  async denyPasswordResetRequest(
    requestId: string,
    actor: JwtPayload,
    notes?: string,
  ): Promise<{ message: string }> {
    const conn = this.em.getConnection();
    const rows = await conn.execute(
      `SELECT identifier, status FROM password_reset_requests WHERE id = ?`,
      [requestId],
    );
    if (rows.length === 0) {
      throw new NotFoundException(`Reset request ${requestId} not found`);
    }
    if (rows[0].status !== 'PENDING') {
      throw new BadRequestException(
        'Only pending reset requests can be denied.',
      );
    }

    await conn.execute(
      `UPDATE password_reset_requests
       SET status = 'DENIED', notes = ?, completed_by = ?, completed_at = NOW()
       WHERE id = ? AND status = 'PENDING'`,
      [notes ?? null, actor.sub, requestId],
    );

    this.logger.log(
      `PASSWORD_RESET_DENIED: request=${requestId}, by=${actor.sub}`,
    );
    void this.activityLog.logAction(
      actor,
      ActivityAction.PASSWORD_RESET_DENIED,
      'user',
      requestId,
      { identifier: rows[0].identifier },
    );

    return { message: 'Reset request denied. No password was changed.' };
  }

  // PHASE BBBA (BBBA-1f, R-294): READ-ONLY duplicate-identity report. Heuristic candidate pairs of
  // likely same-person accounts (shared email, or a username matching another account's email /
  // email local-part). No mutation — merging is a deferred manual action requiring per-pair sign-off.
  async getDuplicateCandidates(): Promise<
    Array<{
      reason: string;
      user_a: Record<string, unknown>;
      user_b: Record<string, unknown>;
    }>
  > {
    const conn = this.em.getConnection();
    const rows = await conn.execute(
      `
      SELECT
        a.id AS a_id, a.email AS a_email, a.username AS a_username,
        a.first_name AS a_first, a.last_name AS a_last, a.is_active AS a_active, a.last_login_at AS a_last_login,
        b.id AS b_id, b.email AS b_email, b.username AS b_username,
        b.first_name AS b_first, b.last_name AS b_last, b.is_active AS b_active, b.last_login_at AS b_last_login,
        CASE
          WHEN lower(a.email) = lower(b.email) THEN 'SHARED_EMAIL'
          WHEN lower(a.username) = lower(b.email) OR lower(a.email) = lower(b.username) THEN 'USERNAME_EQUALS_EMAIL'
          ELSE 'SHARED_EMAIL_LOCALPART'
        END AS reason
      FROM users a
      JOIN users b ON a.id < b.id
      WHERE a.deleted_at IS NULL AND b.deleted_at IS NULL
        AND a.email IS NOT NULL AND b.email IS NOT NULL
        AND (
          lower(a.email) = lower(b.email)
          OR lower(a.username) = lower(b.email)
          OR lower(a.email) = lower(b.username)
          OR lower(split_part(a.email, '@', 1)) = lower(b.username)
          OR lower(a.username) = lower(split_part(b.email, '@', 1))
        )
      ORDER BY reason, a.email
      `,
      [],
    );
    return rows.map((r: any) => ({
      reason: r.reason,
      user_a: {
        id: r.a_id,
        email: r.a_email,
        username: r.a_username,
        first_name: r.a_first,
        last_name: r.a_last,
        is_active: r.a_active,
        last_login_at: r.a_last_login,
      },
      user_b: {
        id: r.b_id,
        email: r.b_email,
        username: r.b_username,
        first_name: r.b_first,
        last_name: r.b_last,
        is_active: r.b_active,
        last_login_at: r.b_last_login,
      },
    }));
  }

  // --- Phase HV: Cross-User Bulk Access Update ---

  async bulkCrossUserAccessUpdate(
    dto: BulkCrossUserAccessDto,
    adminId: string,
  ): Promise<BulkCrossUserResult> {
    if (!dto.userIds || dto.userIds.length === 0) {
      throw new BadRequestException('userIds array cannot be empty');
    }
    if (dto.userIds.length > 50) {
      throw new BadRequestException('Cannot update more than 50 users at once');
    }

    const result: BulkCrossUserResult = {
      success: true,
      total: dto.userIds.length,
      applied: 0,
      skipped: 0,
      errors: [],
    };

    await this.em.transactional(async (em) => {
      for (const userId of dto.userIds) {
        try {
          const u = await em.findOne(User, { id: userId });
          if (!u) {
            result.skipped++;
            result.errors.push(`User ${userId}: not found`);
            continue;
          }

          const canModify = await this.canModifyUser(adminId, userId);
          if (!canModify) {
            result.skipped++;
            result.errors.push(`User ${userId}: insufficient authority`);
            continue;
          }

          if (dto.type === 'permission') {
            let ovr = await em.findOne(UserPermissionOverride, {
              userId,
              moduleKey: dto.key,
            });
            const grant = dto.action === 'grant';
            if (ovr) {
              ovr.canAccess = grant;
              ovr.updatedBy = adminId;
            } else {
              ovr = em.create(UserPermissionOverride, {
                userId,
                moduleKey: dto.key,
                canAccess: grant,
                createdBy: adminId,
                updatedBy: adminId,
              });
              em.persist(ovr);
            }
            result.applied++;
          } else if (dto.type === 'module') {
            if (dto.action === 'grant') {
              const existing = await em.findOne(UserModuleAssignment, {
                userId,
                module: dto.key as any,
              });
              if (!existing) {
                const entity = em.create(UserModuleAssignment, {
                  userId,
                  module: dto.key as any,
                  assignedBy: adminId,
                });
                em.persist(entity);
              }
            } else {
              await em.nativeDelete(UserModuleAssignment, {
                userId,
                module: dto.key as any,
              });
            }
            result.applied++;
          } else if (dto.type === 'pillar') {
            if (dto.action === 'grant') {
              const existing = await em.findOne(UserPillarAssignment, {
                userId,
                pillarType: dto.key,
              });
              if (!existing) {
                const entity = em.create(UserPillarAssignment, {
                  userId,
                  pillarType: dto.key,
                  assignedBy: adminId,
                });
                em.persist(entity);
              }
            } else {
              await em.nativeDelete(UserPillarAssignment, {
                userId,
                pillarType: dto.key,
              });
            }
            result.applied++;
          }
        } catch (err) {
          result.skipped++;
          result.errors.push(`User ${userId}: ${err.message}`);
        }
      }
    });

    this.logger.log(
      `BULK_CROSS_USER_ACCESS: type=${dto.type}, action=${dto.action}, key=${dto.key}, applied=${result.applied}/${result.total}, by=${adminId}`,
    );

    return result;
  }
}
