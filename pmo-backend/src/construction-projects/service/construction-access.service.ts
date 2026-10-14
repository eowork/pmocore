import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { ConstructionProject, RecordAssignment } from '../../database/entities';
import { ConstructionProjectRepository } from '../repository/construction-project.repository';
import { RecordAssignmentRepository } from '../repository/record-assignment.repository';
import { ActivityLogService } from '../../activity-logs/activity-log.service';
import { ActivityAction } from '../../activity-logs/activity-log.entity';
import { PermissionResolverService } from '../../common/services';
import { ModuleType } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces';

/**
 * Cross-cutting checks every construction sub-resource needs: the project exists, the
 * caller may act on it, and the action is written to the activity log.
 *
 * These used to be private helpers on ConstructionProjectsService. They live here so the
 * per-resource services (milestones, gallery, documents, ...) can share one implementation
 * instead of each growing its own copy, and so a rule change lands in a single place.
 */
@Injectable()
export class ConstructionAccessService {
  constructor(
    @InjectRepository(ConstructionProject)
    private readonly cpRepo: ConstructionProjectRepository,
    @InjectRepository(RecordAssignment)
    private readonly assignmentRepo: RecordAssignmentRepository,
    private readonly permissionResolver: PermissionResolverService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * Phase JT-D-6 — fire-and-forget log helper. Never blocks the calling CUD operation.
   */
  fireLog(
    user: JwtPayload | null | undefined,
    action: ActivityAction,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!user) return;
    void this.activityLog
      .logAction(user, action, 'CONSTRUCTION_PROJECT', entityId, metadata)
      .catch(() => {});
  }

  /**
   * 404 unless a live project with this id exists. Sub-resource routes all start with this
   * so a request for a child of a missing project fails as a missing project rather than as
   * an empty list.
   */
  async assertProjectExists(projectId: string): Promise<void> {
    if (!(await this.cpRepo.existsActive(projectId))) {
      throw new NotFoundException(
        `Construction project with ID ${projectId} not found`,
      );
    }
  }

  /**
   * PS-A: Enforce per-action project-level permissions for non-Admin assigned users.
   * Admin (system role) and project creator bypass all checks.
   * Called before every sub-resource CUD operation.
   */
  async assertProjectPermission(
    projectId: string,
    userId: string,
    user: JwtPayload | undefined,
    permission: 'canCreate' | 'canEdit' | 'canDelete' | 'canUpload',
  ): Promise<void> {
    if (user && this.permissionResolver.isAdmin(user)) return; // Admin bypass
    // Owner bypass
    const createdBy = await this.cpRepo.findCreatedBy(projectId);
    if (createdBy === userId) return;
    // Check assignment permissions
    const assignment = await this.assignmentRepo.findUserAssignment(
      ModuleType.CONSTRUCTION,
      projectId,
      userId,
    );
    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this project');
    }
    const perms = assignment.permissions as Record<string, unknown> | null;
    if (!perms || !perms[permission]) {
      throw new ForbiddenException(
        `Permission denied: ${permission} is not granted for this project`,
      );
    }
  }

  /**
   * Approval authority for submit/publish/reject/withdraw: Admin, OR a module-level
   * Approver/Manager grant on 'coi' (Layer 3 — bypasses record scope org-wide), OR
   * this specific project's record_assignments.permissions.canApprove (Layer 4 —
   * a record-level Manager assigned to just this project, per the frontend's
   * FullPermissions shape / accessLevel: Manager). Deliberately NO owner bypass here
   * (unlike assertProjectPermission above) — owning a project isn't itself approval
   * authority; a Contributor/owner may edit but not approve/submit their own work.
   */
  async hasApprovalAuthority(
    projectId: string,
    userId: string,
    user: JwtPayload,
  ): Promise<boolean> {
    if (await this.permissionResolver.canApproveModule(user, 'coi'))
      return true;
    const perms = await this.assignmentRepo.findPermissions(
      ModuleType.CONSTRUCTION,
      projectId,
      userId,
    );
    return !!perms?.canApprove;
  }
}
