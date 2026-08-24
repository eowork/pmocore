import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { AccessRequest, User } from '../database/entities';
import { UsersService } from '../users/users.service';
import { SetPermissionOverrideDto } from '../users/dto';
import { CreateAccessRequestDto, DecideAccessRequestDto } from './dto';
import { JwtPayload } from '../common/interfaces';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { ActivityAction } from '../activity-logs/activity-log.entity';

/**
 * PHASE BBBA (BBBA-3c) — self-service access requests.
 * Approval lifts default-DENY by writing a `user_permission_overrides` grant via UsersService.
 */
@Injectable()
export class AccessRequestsService {
  private readonly logger = new Logger(AccessRequestsService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly usersService: UsersService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async create(userId: string, dto: CreateAccessRequestDto) {
    const existing = await this.em.findOne(AccessRequest, {
      userId,
      requestedModule: dto.requested_module,
      status: 'PENDING',
    });
    if (existing) {
      throw new ConflictException(
        'You already have a pending request for this module.',
      );
    }

    const entity = this.em.create(AccessRequest, {
      userId,
      requestedModule: dto.requested_module,
      requestedLevel: dto.requested_level,
      justification: dto.justification ?? undefined,
      status: 'PENDING',
    });
    await this.em.persistAndFlush(entity);
    this.logger.log(
      `ACCESS_REQUEST_CREATED: user=${userId}, module=${dto.requested_module}, level=${dto.requested_level}`,
    );
    void this.activityLog.logAction(
      await this.actorFor(userId),
      ActivityAction.ACCESS_REQUEST,
      'access_request',
      entity.id,
      { module: dto.requested_module, level: dto.requested_level },
    );
    return this.toDto(entity);
  }

  async listPending() {
    const rows = await this.em.find(
      AccessRequest,
      { status: 'PENDING' },
      { orderBy: { requestedAt: 'ASC' } },
    );
    return this.enrich(rows);
  }

  // PHASE BBBF (Track 4): admin list with status/search/date filters.
  async list(filters: {
    status?: string;
    q?: string;
    from?: string;
    to?: string;
  }) {
    const where: Record<string, any> = {};
    if (filters.status && filters.status !== 'ALL')
      where.status = filters.status;
    if (filters.from || filters.to) {
      where.requestedAt = {};
      if (filters.from) where.requestedAt.$gte = new Date(filters.from);
      if (filters.to)
        where.requestedAt.$lte = new Date(`${filters.to}T23:59:59`);
    }
    const rows = await this.em.find(AccessRequest, where, {
      orderBy: { requestedAt: 'DESC' },
    });
    let enriched = await this.enrich(rows);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      enriched = enriched.filter((r: any) =>
        [
          r.requested_module,
          r.requested_level,
          r.status,
          r.user?.email,
          `${r.user?.first_name ?? ''} ${r.user?.last_name ?? ''}`,
        ]
          .filter(Boolean)
          .some((s: string) => s.toLowerCase().includes(q)),
      );
    }
    return enriched;
  }

  // PHASE BBBF (Track 4): bulk approve/deny (skips non-pending; atomic per row, audited via decide()).
  async bulkDecide(
    ids: string[],
    dto: {
      decision: 'APPROVE' | 'DENY';
      granted_level?: string;
      decision_note?: string;
    },
    admin: JwtPayload,
  ): Promise<{ approved: number; denied: number; skipped: number }> {
    let approved = 0;
    let denied = 0;
    let skipped = 0;
    for (const id of ids) {
      try {
        const req = await this.em.findOne(AccessRequest, { id });
        if (!req || req.status !== 'PENDING') {
          skipped++;
          continue;
        }
        await this.decide(
          id,
          {
            decision: dto.decision,
            granted_level: dto.granted_level,
            decision_note: dto.decision_note,
          } as DecideAccessRequestDto,
          admin,
        );
        if (dto.decision === 'APPROVE') approved++;
        else denied++;
      } catch {
        skipped++;
      }
    }
    return { approved, denied, skipped };
  }

  // PHASE BBBF (Track 4): bulk archive already-decided requests (declutters the queue).
  async bulkArchive(
    ids: string[],
    admin: JwtPayload,
  ): Promise<{ archived: number }> {
    let archived = 0;
    for (const id of ids) {
      const req = await this.em.findOne(AccessRequest, { id });
      if (req && (req.status === 'APPROVED' || req.status === 'DENIED')) {
        req.status = 'ARCHIVED';
        req.decidedBy = req.decidedBy ?? admin.sub;
        archived++;
      }
    }
    await this.em.flush();
    this.logger.log(
      `ACCESS_REQUEST_BULK_ARCHIVE: count=${archived}, by=${admin.sub}`,
    );
    return { archived };
  }

  async countPending(): Promise<{ count: number }> {
    const count = await this.em.count(AccessRequest, { status: 'PENDING' });
    return { count };
  }

  async mine(userId: string) {
    const rows = await this.em.find(
      AccessRequest,
      { userId },
      { orderBy: { requestedAt: 'DESC' } },
    );
    return rows.map((r) => this.toDto(r));
  }

  async decide(id: string, dto: DecideAccessRequestDto, admin: JwtPayload) {
    const req = await this.em.findOne(AccessRequest, { id });
    if (!req) {
      throw new NotFoundException('Access request not found');
    }
    if (req.status !== 'PENDING') {
      throw new BadRequestException('This request has already been decided.');
    }

    if (dto.decision === 'APPROVE') {
      // Lift default-DENY for the module AND set the per-module CRUD level (BBBC Track 8a).
      const level = dto.granted_level ?? req.requestedLevel;
      const grantDto = {
        module_key: req.requestedModule,
        can_access: true,
        granted_level: level,
      } as SetPermissionOverrideDto;
      await this.usersService.setPermissionOverride(
        req.userId,
        grantDto,
        admin.sub,
      );
      req.status = 'APPROVED';
      req.grantedLevel = level;
    } else {
      req.status = 'DENIED';
    }
    req.decisionNote = dto.decision_note ?? undefined;
    req.decidedBy = admin.sub;
    req.decidedAt = new Date();
    await this.em.flush();

    this.logger.log(
      `ACCESS_REQUEST_DECIDED: id=${id}, decision=${dto.decision}, module=${req.requestedModule}, by=${admin.sub}`,
    );
    void this.activityLog.logAction(
      admin,
      dto.decision === 'APPROVE'
        ? ActivityAction.ACCESS_APPROVE
        : ActivityAction.ACCESS_REJECT,
      'access_request',
      req.id,
      {
        target_user: req.userId,
        module: req.requestedModule,
        granted_level: req.grantedLevel,
      },
    );
    return this.toDto(req);
  }

  // PHASE BBBG (Track 2): revoke a granted request — removes the live permission override
  // (the actual access) AND marks the request REVOKED, so history stays visible and auditable.
  async revoke(id: string, admin: JwtPayload, note?: string) {
    const req = await this.em.findOne(AccessRequest, { id });
    if (!req) {
      throw new NotFoundException('Access request not found');
    }
    if (req.status !== 'APPROVED') {
      throw new BadRequestException('Only approved requests can be revoked.');
    }

    // Remove the granting override (the source of access). Tolerate an already-removed
    // override (admin may have cleared it directly) so the status still flips to REVOKED.
    try {
      await this.usersService.removePermissionOverride(
        req.userId,
        req.requestedModule,
        admin.sub,
      );
    } catch (err) {
      this.logger.warn(
        `ACCESS_REQUEST_REVOKE: override already absent for user=${req.userId} module=${req.requestedModule} — ${(err as Error).message}`,
      );
    }

    req.status = 'REVOKED';
    req.decisionNote = note ?? req.decisionNote ?? undefined;
    req.decidedBy = admin.sub;
    req.decidedAt = new Date();
    await this.em.flush();

    this.logger.log(
      `ACCESS_REQUEST_REVOKED: id=${id}, module=${req.requestedModule}, by=${admin.sub}`,
    );
    void this.activityLog.logAction(
      admin,
      ActivityAction.ACCESS_REVOKED,
      'access_request',
      req.id,
      { target_user: req.userId, module: req.requestedModule },
    );
    return this.toDto(req);
  }

  // PHASE BBBG (Track 2): reopen a DENIED/REVOKED request back to PENDING so it is re-decidable.
  // No access is granted here — a subsequent decide() re-applies the override (and is audited there).
  async reopen(id: string, admin: JwtPayload) {
    const req = await this.em.findOne(AccessRequest, { id });
    if (!req) {
      throw new NotFoundException('Access request not found');
    }
    if (
      req.status !== 'DENIED' &&
      req.status !== 'REVOKED' &&
      req.status !== 'EXPIRED'
    ) {
      throw new BadRequestException(
        'Only denied, revoked, or expired requests can be reopened.',
      );
    }
    req.status = 'PENDING';
    req.decisionNote = undefined;
    req.decidedBy = undefined;
    req.decidedAt = undefined;
    await this.em.flush();
    this.logger.log(`ACCESS_REQUEST_REOPENED: id=${id}, by=${admin.sub}`);
    void this.activityLog.logAction(
      admin,
      ActivityAction.ACCESS_REOPENED,
      'access_request',
      req.id,
      { target_user: req.userId, module: req.requestedModule },
    );
    return this.toDto(req);
  }

  // PHASE BBBG (Track 2): user cancels their own pending request (PENDING → CANCELLED).
  async cancel(id: string, userId: string) {
    const req = await this.em.findOne(AccessRequest, { id });
    if (!req) {
      throw new NotFoundException('Access request not found');
    }
    if (req.userId !== userId) {
      throw new BadRequestException('You can only cancel your own requests.');
    }
    if (req.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be cancelled.');
    }
    req.status = 'CANCELLED';
    await this.em.flush();
    this.logger.log(`ACCESS_REQUEST_CANCELLED: id=${id}, by=${userId}`);
    void this.activityLog.logAction(
      await this.actorFor(userId),
      ActivityAction.ACCESS_CANCELLED,
      'access_request',
      req.id,
      { module: req.requestedModule, level: req.requestedLevel },
    );
    return this.toDto(req);
  }

  // PHASE BBBG (Track 2): manual expiry of a stale pending request (PENDING → EXPIRED).
  // Operator decision (2026-06-16): no scheduled TTL job — expiry is an explicit admin action.
  async expire(id: string, admin: JwtPayload) {
    const req = await this.em.findOne(AccessRequest, { id });
    if (!req) {
      throw new NotFoundException('Access request not found');
    }
    if (req.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be expired.');
    }
    req.status = 'EXPIRED';
    req.decidedBy = admin.sub;
    req.decidedAt = new Date();
    await this.em.flush();
    this.logger.log(`ACCESS_REQUEST_EXPIRED: id=${id}, by=${admin.sub}`);
    void this.activityLog.logAction(
      admin,
      ActivityAction.ACCESS_EXPIRED,
      'access_request',
      req.id,
      { target_user: req.userId, module: req.requestedModule },
    );
    return this.toDto(req);
  }

  // PHASE BBCH (Track 3, R-374): build a real actor payload for self-service actions so audit
  // rows carry the requester's email/name (logAction uses user.email), not a blank string.
  private async actorFor(userId: string): Promise<JwtPayload> {
    const u = await this.em.findOne(User, { id: userId }, { filters: false });
    return {
      sub: userId,
      email: u?.email ?? '',
      roles: [],
      is_superadmin: false,
    };
  }

  private toDto(r: AccessRequest) {
    return {
      id: r.id,
      user_id: r.userId,
      requested_module: r.requestedModule,
      requested_level: r.requestedLevel,
      justification: r.justification ?? null,
      status: r.status,
      granted_level: r.grantedLevel ?? null,
      decision_note: r.decisionNote ?? null,
      decided_by: r.decidedBy ?? null,
      decided_at: r.decidedAt ?? null,
      requested_at: r.requestedAt,
    };
  }

  private async enrich(rows: AccessRequest[]) {
    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const users = userIds.length
      ? await this.em.find(User, { id: { $in: userIds } }, { filters: false })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => {
      const u = byId.get(r.userId);
      return {
        ...this.toDto(r),
        user: u
          ? {
              id: u.id,
              email: u.email,
              first_name: u.firstName,
              last_name: u.lastName,
            }
          : null,
      };
    });
  }
}
