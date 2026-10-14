import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { ConstructionTimelineEntry } from '../../database/entities';
import { ConstructionTimelineEntryRepository } from '../repository/construction-timeline-entry.repository';
import { ConstructionAccessService } from './construction-access.service';
import { ActivityAction } from '../../activity-logs/activity-log.entity';
import { JwtPayload } from '../../common/interfaces';
import {
  BatchCreateTimelineEntryDto,
  CreateTimelineEntryDto,
  UpdateTimelineEntryDto,
} from '../dto';

/**
 * Timeline diary entries (Phase JW-G). Split out of ConstructionProjectsService; the URLs
 * and behaviour are unchanged.
 */
@Injectable()
export class TimelineDiaryEntryService {
  private readonly logger = new Logger(TimelineDiaryEntryService.name);

  constructor(
    @InjectRepository(ConstructionTimelineEntry)
    private readonly timelineEntryRepo: ConstructionTimelineEntryRepository,
    private readonly access: ConstructionAccessService,
  ) {}

  async findTimelineEntries(
    projectId: string,
  ): Promise<ConstructionTimelineEntry[]> {
    await this.access.assertProjectExists(projectId);
    return this.timelineEntryRepo.findByProject(projectId);
  }

  async createTimelineEntry(
    projectId: string,
    dto: CreateTimelineEntryDto,
    userId: string,
    user?: JwtPayload,
  ): Promise<ConstructionTimelineEntry> {
    await this.access.assertProjectExists(projectId);
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        userId,
        user,
        'canCreate',
      );
    const entity = await this.timelineEntryRepo.createForProject(
      projectId,
      dto,
      userId,
    );
    this.logger.log(
      `TIMELINE_ENTRY_CREATED: id=${entity.id}, project=${projectId}, by=${userId}`,
    );
    this.access.fireLog(user, ActivityAction.CREATE, projectId, {
      timelineEntryId: entity.id,
      entryType: entity.entryType,
    });
    return entity;
  }

  async updateTimelineEntry(
    projectId: string,
    entryId: string,
    dto: UpdateTimelineEntryDto,
    userId: string,
    user?: JwtPayload,
  ): Promise<ConstructionTimelineEntry> {
    await this.access.assertProjectExists(projectId);
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        userId,
        user,
        'canEdit',
      );
    const entity = await this.timelineEntryRepo.findOneForProject(
      projectId,
      entryId,
    );
    if (!entity)
      throw new NotFoundException(`Timeline entry ${entryId} not found`);

    await this.timelineEntryRepo.updateFromDto(entity, dto);

    this.logger.log(
      `TIMELINE_ENTRY_UPDATED: id=${entryId}, project=${projectId}, by=${userId}`,
    );
    this.access.fireLog(user, ActivityAction.UPDATE, projectId, {
      timelineEntryId: entryId,
    });
    return entity;
  }

  async removeTimelineEntry(
    projectId: string,
    entryId: string,
    userId: string,
    user?: JwtPayload,
  ): Promise<void> {
    await this.access.assertProjectExists(projectId);
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        userId,
        user,
        'canDelete',
      );
    const count = await this.timelineEntryRepo.deleteForProject(
      projectId,
      entryId,
    );
    if (count === 0)
      throw new NotFoundException(`Timeline entry ${entryId} not found`);
    this.logger.log(
      `TIMELINE_ENTRY_DELETED: id=${entryId}, project=${projectId}, by=${userId}`,
    );
    this.access.fireLog(user, ActivityAction.DELETE, projectId, {
      timelineEntryId: entryId,
    });
  }

  // LK-F: Batch create timeline entries — single transaction, max 50 rows
  async batchCreateTimelineEntries(
    projectId: string,
    dto: BatchCreateTimelineEntryDto,
    user?: JwtPayload,
  ): Promise<ConstructionTimelineEntry[]> {
    await this.access.assertProjectExists(projectId);
    // Record-scope guard — parity with the single-create timeline route.
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canCreate',
      );
    const entities = await this.timelineEntryRepo.createManyForProject(
      projectId,
      dto.items,
      user?.sub,
    );
    this.logger.log(
      `BATCH_TIMELINE_CREATED: ${entities.length} items, project=${projectId}`,
    );
    this.access.fireLog(user, ActivityAction.CREATE, projectId, {
      batch: true,
      count: entities.length,
    });
    return entities;
  }
}
