import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { JwtPayload } from '../interfaces';
import { User, UserRole, Role } from '../../database/entities';

/**
 * Permission Result for detailed responses
 */
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Centralized Permission Resolver Service
 *
 * Consolidates permission logic previously scattered across service methods.
 * Per ACE governance Phase Q (plan.md), this replaces ad-hoc isAdmin() checks.
 *
 * GOVERNANCE REFERENCE: research.md Section 1.35
 * - Rank is APPROVAL-AUTHORITY ONLY, not CRUD-tier
 * - Role determines CRUD capability (SuperAdmin, Admin, Staff, Viewer)
 * - Rank determines approval chain (lower rank_level = higher authority)
 */
@Injectable()
export class PermissionResolverService {
  private readonly logger = new Logger(PermissionResolverService.name);

  constructor(private readonly em: EntityManager) {}

  /**
   * Check if user has Admin role (from JWT - for read operations)
   * Use this for non-mutation operations where JWT can be trusted
   */
  isAdmin(user: JwtPayload): boolean {
    return user.is_superadmin || user.roles.includes('Admin');
  }

  /**
   * Check if user has Staff role (from JWT)
   */
  isStaff(user: JwtPayload): boolean {
    return this.isAdmin(user) || user.roles.includes('Staff');
  }

  /**
   * QD-A: Check if user has Contractor role (from JWT)
   * Contractors have scoped project access — only assigned COI records.
   */
  isContractor(user: JwtPayload): boolean {
    return !user.is_superadmin && user.roles.includes('Contractor');
  }

  /**
   * Check if user has Admin role (from database - for mutation operations)
   * This prevents JWT token manipulation attacks for critical operations
   */
  async isAdminFromDatabase(userId: string): Promise<boolean> {
    const superadminRole = await this.em.findOne(UserRole, {
      userId,
      isSuperadmin: true,
    });
    if (superadminRole) return true;

    const userRoles = await this.em.find(UserRole, { userId });
    if (userRoles.length === 0) return false;

    const roleIds = userRoles.map((ur) => ur.roleId);
    const adminRole = await this.em.findOne(Role, {
      id: { $in: roleIds },
      name: 'Admin',
    });
    return !!adminRole;
  }

  /**
   * Check if approver can approve a submission based on rank authority
   */
  async canApproveByRank(
    approverId: string,
    submitterId: string,
    isSuperAdmin: boolean,
  ): Promise<PermissionResult> {
    if (isSuperAdmin) {
      return { allowed: true };
    }

    if (approverId === submitterId) {
      return {
        allowed: false,
        reason: 'Cannot approve your own submission',
      };
    }

    const approver = await this.em.findOne(User, { id: approverId });
    const submitter = await this.em.findOne(User, { id: submitterId });

    const approverLevel = approver?.rankLevel ?? 100;
    const submitterLevel = submitter?.rankLevel ?? 100;

    if (approverLevel >= submitterLevel) {
      this.logger.debug(
        `RANK_APPROVAL_DENIED: approver=${approverId} (rank ${approverLevel}) ` +
          `cannot approve submitter=${submitterId} (rank ${submitterLevel})`,
      );
      return {
        allowed: false,
        reason:
          'Insufficient authority: Your rank does not allow you to approve this submission',
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can modify a target user based on rank hierarchy
   * HYBRID: uses can_modify_user() PG stored function
   */
  async canModifyUserByRank(
    actorId: string,
    targetId: string,
    isSuperAdmin: boolean,
  ): Promise<PermissionResult> {
    if (isSuperAdmin) {
      return { allowed: true };
    }

    if (actorId === targetId) {
      return { allowed: true };
    }

    const conn = this.em.getConnection();
    const result = await conn.execute(
      'SELECT can_modify_user(?, ?) as can_modify',
      [actorId, targetId],
    );

    if (!result[0]?.can_modify) {
      return {
        allowed: false,
        reason:
          'Insufficient authority: Cannot modify a user with equal or higher rank',
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user has module assignment for approval
   * HYBRID: uses user_has_module_access() PG stored function
   */
  async hasModuleAssignment(userId: string, module: string): Promise<boolean> {
    const conn = this.em.getConnection();
    const result = await conn.execute(
      'SELECT user_has_module_access(?, ?::module_type) as has_access',
      [userId, module],
    );
    return result[0]?.has_access ?? false;
  }

  /**
   * Phase BBCH (Track 1, backend enforcement): approval authority is Layer 1
   * (Admin/SuperAdmin) OR Layer 3 (an Approver/Manager grant on moduleKey in
   * user_permission_overrides). Mirrors the frontend's usePermissions().canApprove()
   * exactly, so the publish/reject/approve/unlock endpoints accept precisely the
   * users the UI already shows those actions to — no more, no less.
   *
   * Phase HU (2026-09): moduleKey may be an array — university_operations has 2
   * independent per-pillar sub-modules (university-operations-physical/-financial)
   * with their own granted_level; a caller checking only the parent key ignores a
   * sub-module-scoped Approver/Manager grant entirely. Pass all related keys and
   * this returns true if ANY of them grants sufficient level (mirrors
   * ModuleAccessGuard's candidateKeys handling for the same parent/sub-module family).
   */
  async canApproveModule(
    user: JwtPayload,
    moduleKey: string | string[],
  ): Promise<boolean> {
    if (this.isAdmin(user)) return true;

    const keys = Array.isArray(moduleKey) ? moduleKey : [moduleKey];
    const placeholders = keys.map(() => '?').join(',');
    const rows = await this.em.getConnection().execute(
      `SELECT granted_level FROM user_permission_overrides
       WHERE user_id = ? AND module_key IN (${placeholders}) AND can_access = true`,
      [user.sub, ...keys],
    );
    return rows.some(
      (r: any) => r.granted_level === 'Approver' || r.granted_level === 'Manager',
    );
  }
}
