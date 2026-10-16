import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { FilterQuery } from '@mikro-orm/core';
import {
  ConstructionProgressReport,
  ConstructionProject,
} from '../../database/entities';
import { ConstructionProgressReportRepository } from '../repository/construction-progress-report.repository';
import { ConstructionProjectRepository } from '../repository/construction-project.repository';
import { ConstructionAccessService } from './construction-access.service';
import { ActivityAction } from '../../activity-logs/activity-log.entity';
import { JwtPayload } from '../../common/interfaces';
import { CreateProgressReportDto, UpdateProgressReportDto } from '../dto';

/**
 * Progress reports (Phase NE, chronological, MPR/WAR-aligned). Split out of
 * ConstructionProjectsService; the URLs and behaviour are unchanged.
 */
@Injectable()
export class ProgressReportService {
  constructor(
    @InjectRepository(ConstructionProgressReport)
    private readonly progressReportRepo: ConstructionProgressReportRepository,
    @InjectRepository(ConstructionProject)
    private readonly cpRepo: ConstructionProjectRepository,
    private readonly access: ConstructionAccessService,
  ) {}

  async findProgressReports(
    projectId: string,
  ): Promise<ConstructionProgressReport[]> {
    await this.access.assertProjectExists(projectId);
    return this.progressReportRepo.findByProject(projectId);
  }

  /** Re-derive project's physical_progress / cost_incurred_to_date / as_of_date from latest report. */
  private async mirrorLatestReportToProject(projectId: string): Promise<void> {
    const latest = await this.progressReportRepo.findLatest(projectId);
    const filter: FilterQuery<ConstructionProject> = { id: projectId };

    await this.cpRepo.nativeUpdate(filter, {
      physicalProgress: latest?.percentageCompletion ?? '0',
      costIncurredToDate: latest?.costIncurredToDate ?? null,
      asOfDate: latest?.reportDate ?? null,
    });
  }

  async createProgressReport(
    projectId: string,
    dto: CreateProgressReportDto,
    user?: JwtPayload,
  ): Promise<ConstructionProgressReport> {
    await this.access.assertProjectExists(projectId);
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canCreate',
      );
    const entity = this.progressReportRepo.create({
      projectId,
      reportType: dto.report_type,
      reportDate: new Date(dto.report_date),
      reportNumber: dto.report_number,
      percentageCompletion:
        dto.percentage_completion != null
          ? String(dto.percentage_completion)
          : '0.00',
      plannedAccomplishment:
        dto.planned_accomplishment != null
          ? String(dto.planned_accomplishment)
          : undefined,
      slippage: dto.slippage != null ? String(dto.slippage) : undefined,
      costIncurredToDate:
        dto.cost_incurred_to_date != null
          ? String(dto.cost_incurred_to_date)
          : undefined,
      costIncurredThisPeriod:
        dto.cost_incurred_this_period != null
          ? String(dto.cost_incurred_this_period)
          : undefined,
      calendarDaysElapsed: dto.calendar_days_elapsed,
      percentTimeElapsed:
        dto.percent_time_elapsed != null
          ? String(dto.percent_time_elapsed)
          : undefined,
      remarks: dto.remarks,
      issuesEncountered: dto.issues_encountered,
      mitigationActions: dto.mitigation_actions,
      movDocumentId: dto.mov_document_id,
      movLink: dto.mov_link,
      createdBy: user?.sub,
    });
    // OS-D: stamp list fields with timestamp + author
    const now = new Date().toISOString();
    const stampList = (items: any[] | undefined) =>
      (items || []).map((e) => ({
        text: e.text || '',
        author: e.author || user?.email || 'System',
        createdAt: e.created_at || e.createdAt || now,
      }));
    entity.narrativeList = stampList(dto.narrative_list);
    entity.remarksList = stampList(dto.remarks_list);
    entity.issuesEncounteredList = stampList(dto.issues_encountered_list);
    entity.mitigationActionsList = stampList(dto.mitigation_actions_list);
    await this.progressReportRepo.getEntityManager().persist(entity).flush();
    await this.mirrorLatestReportToProject(projectId);
    this.access.fireLog(user, ActivityAction.CREATE, projectId, {
      entityType: 'progress_report',
      progressReportId: entity.id,
      reportType: entity.reportType,
      reportDate: entity.reportDate,
    });
    return entity;
  }

  async updateProgressReport(
    projectId: string,
    reportId: string,
    dto: UpdateProgressReportDto,
    user?: JwtPayload,
  ): Promise<ConstructionProgressReport> {
    await this.access.assertProjectExists(projectId);
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canEdit',
      );
    const entity = await this.progressReportRepo.findOneForProject(
      projectId,
      reportId,
    );
    if (!entity)
      throw new NotFoundException(`Progress report ${reportId} not found`);

    if (dto.report_type !== undefined) entity.reportType = dto.report_type;
    if (dto.report_date !== undefined)
      entity.reportDate = new Date(dto.report_date);
    if (dto.report_number !== undefined)
      entity.reportNumber = dto.report_number;
    // An explicit null clears the field. percentage_completion is NOT NULL in the
    // database, so it resets to zero instead of being written as the string "null",
    // which Postgres rejects with: invalid input syntax for type numeric: "null".
    if (dto.percentage_completion !== undefined)
      entity.percentageCompletion =
        dto.percentage_completion != null
          ? String(dto.percentage_completion)
          : '0.00';
    if (dto.planned_accomplishment !== undefined)
      entity.plannedAccomplishment =
        dto.planned_accomplishment != null
          ? String(dto.planned_accomplishment)
          : undefined;
    if (dto.slippage !== undefined)
      entity.slippage = dto.slippage != null ? String(dto.slippage) : undefined;
    if (dto.cost_incurred_to_date !== undefined)
      entity.costIncurredToDate =
        dto.cost_incurred_to_date != null
          ? String(dto.cost_incurred_to_date)
          : undefined;
    if (dto.cost_incurred_this_period !== undefined)
      entity.costIncurredThisPeriod =
        dto.cost_incurred_this_period != null
          ? String(dto.cost_incurred_this_period)
          : undefined;
    if (dto.calendar_days_elapsed !== undefined)
      entity.calendarDaysElapsed = dto.calendar_days_elapsed;
    if (dto.percent_time_elapsed !== undefined)
      entity.percentTimeElapsed =
        dto.percent_time_elapsed != null
          ? String(dto.percent_time_elapsed)
          : undefined;
    if (dto.remarks !== undefined) entity.remarks = dto.remarks;
    if (dto.issues_encountered !== undefined)
      entity.issuesEncountered = dto.issues_encountered;
    if (dto.mitigation_actions !== undefined)
      entity.mitigationActions = dto.mitigation_actions;
    if (dto.mov_document_id !== undefined)
      entity.movDocumentId = dto.mov_document_id;
    if (dto.mov_link !== undefined) entity.movLink = dto.mov_link;
    // OS-D: update list fields if provided. Each list is applied on its own so a PATCH
    // carrying only one of them does not silently wipe the other three, which the old
    // single 'if (narrative_list)' gate did.
    const now = new Date().toISOString();
    const stampList = (items: any[] | null | undefined) =>
      (items || []).map((e) => ({
        text: e.text || '',
        author: e.author || user?.email || 'System',
        createdAt: e.created_at || e.createdAt || now,
      }));
    if (dto.narrative_list !== undefined)
      entity.narrativeList = stampList(dto.narrative_list);
    if (dto.remarks_list !== undefined)
      entity.remarksList = stampList(dto.remarks_list);
    if (dto.issues_encountered_list !== undefined)
      entity.issuesEncounteredList = stampList(dto.issues_encountered_list);
    if (dto.mitigation_actions_list !== undefined)
      entity.mitigationActionsList = stampList(dto.mitigation_actions_list);
    entity.updatedBy = user?.sub;
    await this.progressReportRepo.getEntityManager().flush();
    await this.mirrorLatestReportToProject(projectId);
    this.access.fireLog(user, ActivityAction.UPDATE, projectId, {
      entityType: 'progress_report',
      progressReportId: reportId,
      changedFields: Object.keys(dto),
    });
    return entity;
  }

  async removeProgressReport(
    projectId: string,
    reportId: string,
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
    const entity = await this.progressReportRepo.findOneForProject(
      projectId,
      reportId,
    );
    if (!entity)
      throw new NotFoundException(`Progress report ${reportId} not found`);
    await this.progressReportRepo.getEntityManager().remove(entity).flush();
    await this.mirrorLatestReportToProject(projectId);
    this.access.fireLog(user, ActivityAction.DELETE, projectId, {
      entityType: 'progress_report',
      progressReportId: reportId,
    });
  }
}
