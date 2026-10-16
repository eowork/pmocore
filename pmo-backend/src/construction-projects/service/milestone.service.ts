import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { ConstructionMilestone } from '../../database/entities';
import { ConstructionMilestoneRepository } from '../repository/construction-milestone.repository';
import { ConstructionAccessService } from './construction-access.service';
import { ActivityAction } from '../../activity-logs/activity-log.entity';
import { JwtPayload } from '../../common/interfaces';
import { BatchCreateMilestoneDto, CreateMilestoneDto } from '../dto';

/**
 * Project milestones. Split out of ConstructionProjectsService so the milestone routes own
 * their own service; the URLs and behaviour are unchanged.
 */
@Injectable()
export class MilestoneService {
  private readonly logger = new Logger(MilestoneService.name);

  constructor(
    @InjectRepository(ConstructionMilestone)
    private readonly milestoneRepo: ConstructionMilestoneRepository,
    private readonly access: ConstructionAccessService,
  ) {}

  async findMilestones(projectId: string): Promise<ConstructionMilestone[]> {
    await this.access.assertProjectExists(projectId);
    return this.milestoneRepo.findByProject(projectId);
  }

  async createMilestone(
    projectId: string,
    dto: CreateMilestoneDto,
    user?: JwtPayload,
  ): Promise<ConstructionMilestone> {
    await this.access.assertProjectExists(projectId);
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canCreate',
      );
    const entity = await this.milestoneRepo.createForProject(
      projectId,
      dto,
      user?.sub,
    );
    this.logger.log(`MILESTONE_CREATED: id=${entity.id}, project=${projectId}`);
    this.access.fireLog(user, ActivityAction.CREATE, projectId, {
      milestoneId: entity.id,
      title: dto.title,
    });
    return entity;
  }

  async updateMilestone(
    projectId: string,
    milestoneId: string,
    dto: Partial<CreateMilestoneDto>,
    user?: JwtPayload,
  ): Promise<ConstructionMilestone> {
    await this.access.assertProjectExists(projectId);
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canEdit',
      );
    const entity = await this.milestoneRepo.findOneForProject(
      projectId,
      milestoneId,
    );
    if (!entity)
      throw new NotFoundException(`Milestone ${milestoneId} not found`);

    await this.milestoneRepo.updateFromDto(entity, dto, user?.sub);

    this.logger.log(`MILESTONE_UPDATED: id=${milestoneId}`);
    this.access.fireLog(user, ActivityAction.UPDATE, projectId, {
      milestoneId,
      title: entity.title,
    });
    return entity;
  }

  async removeMilestone(
    projectId: string,
    milestoneId: string,
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
    // LI-D: fetch title before delete for audit log
    const entity = await this.milestoneRepo.findOneForProject(
      projectId,
      milestoneId,
    );
    if (!entity)
      throw new NotFoundException(`Milestone ${milestoneId} not found`);
    this.access.fireLog(user, ActivityAction.DELETE, projectId, {
      milestoneId,
      title: entity.title,
    });
    await this.milestoneRepo.removeMilestone(entity);
    this.logger.log(`MILESTONE_DELETED: id=${milestoneId}`);
  }

  // LK-C: Batch create milestones — single transaction, max 50 rows
  async batchCreateMilestones(
    projectId: string,
    dto: BatchCreateMilestoneDto,
    user?: JwtPayload,
  ): Promise<ConstructionMilestone[]> {
    await this.access.assertProjectExists(projectId);
    // Record-scope guard. The single-create route above has always had one; the batch route
    // did not, and was reachable by anyone holding 'coi' module access.
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canCreate',
      );
    const entities = await this.milestoneRepo.createManyForProject(
      projectId,
      dto.items,
      user?.sub,
    );
    this.logger.log(
      `BATCH_MILESTONE_CREATED: ${entities.length} items, project=${projectId}`,
    );
    this.access.fireLog(user, ActivityAction.CREATE, projectId, {
      batch: true,
      count: entities.length,
    });
    return entities;
  }
}
