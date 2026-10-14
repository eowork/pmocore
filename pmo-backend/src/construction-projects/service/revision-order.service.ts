import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  ConstructionProject,
  ConstructionRevisionOrder,
} from '../../database/entities';
import { ConstructionRevisionOrderRepository } from '../repository/construction-revision-order.repository';
import { ConstructionProjectRepository } from '../repository/construction-project.repository';
import { ConstructionAccessService } from './construction-access.service';
import { ActivityAction } from '../../activity-logs/activity-log.entity';
import { JwtPayload } from '../../common/interfaces';
import { CreateRevisionOrderDto, UpdateRevisionOrderDto } from '../dto';

/**
 * Revision orders (Phase ND, audit-tracked). Split out of ConstructionProjectsService; the
 * URLs and behaviour are unchanged.
 */
@Injectable()
export class RevisionOrderService {
  constructor(
    @InjectRepository(ConstructionRevisionOrder)
    private readonly revisionOrderRepo: ConstructionRevisionOrderRepository,
    @InjectRepository(ConstructionProject)
    private readonly cpRepo: ConstructionProjectRepository,
    private readonly access: ConstructionAccessService,
  ) {}

  async findRevisionOrders(
    projectId: string,
  ): Promise<ConstructionRevisionOrder[]> {
    await this.access.assertProjectExists(projectId);
    return this.revisionOrderRepo.findByProject(projectId);
  }

  /** Re-derive project's revised_* mirror fields from latest APPROVED revision. */
  private async mirrorLatestApprovedRevisionToProject(
    projectId: string,
  ): Promise<void> {
    const latest = await this.revisionOrderRepo.findLatestApproved(projectId);

    await this.cpRepo.nativeUpdate(
      { id: projectId },
      {
        revisedStartDate: latest?.newStartDate ?? null,
        revisedCompletionDate: latest?.newCompletionDate ?? null,
        revisedProjectDuration: latest?.newDuration ?? null,
      },
    );
  }

  async createRevisionOrder(
    projectId: string,
    dto: CreateRevisionOrderDto,
    user?: JwtPayload,
  ): Promise<ConstructionRevisionOrder> {
    await this.access.assertProjectExists(projectId);
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canCreate',
      );
    // Auto-increment revision_number per project
    const nextNumber =
      await this.revisionOrderRepo.nextRevisionNumber(projectId);

    const entity = this.revisionOrderRepo.create({
      projectId,
      revisionNumber: nextNumber,
      revisionType: dto.revision_type,
      revisionDate: new Date(dto.revision_date),
      newStartDate: dto.new_start_date
        ? new Date(dto.new_start_date)
        : undefined,
      newCompletionDate: dto.new_completion_date
        ? new Date(dto.new_completion_date)
        : undefined,
      newDuration: dto.new_duration,
      costAdjustment:
        dto.cost_adjustment != null ? String(dto.cost_adjustment) : undefined,
      justification: dto.justification,
      approvalStatus: dto.approval_status ?? 'DRAFT',
      movDocumentId: dto.mov_document_id,
      movLink: dto.mov_link,
      createdBy: user?.sub,
    });
    await this.revisionOrderRepo.getEntityManager().persist(entity).flush();
    await this.mirrorLatestApprovedRevisionToProject(projectId);
    this.access.fireLog(user, ActivityAction.CREATE, projectId, {
      entityType: 'revision_order',
      revisionOrderId: entity.id,
      revisionNumber: entity.revisionNumber,
    });
    return entity;
  }

  async updateRevisionOrder(
    projectId: string,
    roId: string,
    dto: UpdateRevisionOrderDto,
    user?: JwtPayload,
  ): Promise<ConstructionRevisionOrder> {
    await this.access.assertProjectExists(projectId);
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canEdit',
      );
    const entity = await this.revisionOrderRepo.findOneForProject(
      projectId,
      roId,
    );
    if (!entity)
      throw new NotFoundException(`Revision order ${roId} not found`);

    if (dto.revision_type !== undefined)
      entity.revisionType = dto.revision_type;
    if (dto.revision_date !== undefined)
      entity.revisionDate = new Date(dto.revision_date);
    if (dto.new_start_date !== undefined)
      entity.newStartDate = dto.new_start_date
        ? new Date(dto.new_start_date)
        : undefined;
    if (dto.new_completion_date !== undefined)
      entity.newCompletionDate = dto.new_completion_date
        ? new Date(dto.new_completion_date)
        : undefined;
    if (dto.new_duration !== undefined) entity.newDuration = dto.new_duration;
    if (dto.cost_adjustment !== undefined)
      entity.costAdjustment =
        dto.cost_adjustment != null ? String(dto.cost_adjustment) : undefined;
    if (dto.justification !== undefined)
      entity.justification = dto.justification;
    if (dto.approval_status !== undefined)
      entity.approvalStatus = dto.approval_status;
    if (dto.mov_document_id !== undefined)
      entity.movDocumentId = dto.mov_document_id;
    if (dto.mov_link !== undefined) entity.movLink = dto.mov_link;
    entity.updatedBy = user?.sub;
    await this.revisionOrderRepo.getEntityManager().flush();
    await this.mirrorLatestApprovedRevisionToProject(projectId);
    this.access.fireLog(user, ActivityAction.UPDATE, projectId, {
      entityType: 'revision_order',
      revisionOrderId: roId,
      changedFields: Object.keys(dto),
    });
    return entity;
  }

  async removeRevisionOrder(
    projectId: string,
    roId: string,
    user?: JwtPayload,
  ): Promise<void> {
    await this.access.assertProjectExists(projectId);
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canDelete',
      );
    const entity = await this.revisionOrderRepo.findOneForProject(
      projectId,
      roId,
    );
    if (!entity)
      throw new NotFoundException(`Revision order ${roId} not found`);
    await this.revisionOrderRepo.getEntityManager().remove(entity).flush();
    await this.mirrorLatestApprovedRevisionToProject(projectId);
    this.access.fireLog(user, ActivityAction.DELETE, projectId, {
      entityType: 'revision_order',
      revisionOrderId: roId,
    });
  }
}
