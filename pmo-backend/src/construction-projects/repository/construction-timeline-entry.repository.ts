import { EntityRepository } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { ConstructionTimelineEntry } from '../../database/entities';
import type { CreateTimelineEntryDto, UpdateTimelineEntryDto } from '../dto';

/**
 * Parse a DTO date field. The DTOs carry dates as strings; an empty string or null means
 * "no date", which has to stay undefined rather than becoming an Invalid Date.
 */
function toDate(value?: string | null): Date | undefined {
  return value ? new Date(value) : undefined;
}

export class ConstructionTimelineEntryRepository extends EntityRepository<ConstructionTimelineEntry> {
  /** Every timeline entry on a project, newest first. */
  findByProject(projectId: string): Promise<ConstructionTimelineEntry[]> {
    return this.find({ projectId }, { orderBy: { entryDate: 'desc' } });
  }

  /**
   * A single entry, scoped to its project. The projectId is part of the lookup rather than
   * checked afterwards, so an id belonging to another project simply does not match.
   */
  findOneForProject(
    projectId: string,
    entryId: string,
  ): Promise<ConstructionTimelineEntry | null> {
    return this.findOne({ id: entryId, projectId });
  }

  /** Create and persist one entry. */
  async createForProject(
    projectId: string,
    dto: CreateTimelineEntryDto,
    userId?: string,
  ): Promise<ConstructionTimelineEntry> {
    const entity = this.buildFromDto(projectId, dto, userId);
    await this.getEntityManager().persist(entity).flush();
    return entity;
  }

  /**
   * LK-F: create a batch of entries in a single flush, so a failure part-way through leaves
   * none of them behind.
   */
  async createManyForProject(
    projectId: string,
    items: CreateTimelineEntryDto[],
    userId?: string,
  ): Promise<ConstructionTimelineEntry[]> {
    const entities = items.map((item) =>
      this.buildFromDto(projectId, item, userId),
    );
    await this.getEntityManager().persist(entities).flush();
    return entities;
  }

  /**
   * Apply a partial update. Only the fields the caller actually sent are touched — a field
   * left out of the DTO keeps its stored value, while one sent as null is cleared.
   *
   * No audit columns are written here. Unlike milestones, this table's update path has never
   * set updatedBy/updatedAt, and backfilling them on edit would change what the history
   * shows for every entry touched from now on.
   */
  async updateFromDto(
    entity: ConstructionTimelineEntry,
    dto: UpdateTimelineEntryDto,
  ): Promise<ConstructionTimelineEntry> {
    if (dto.entry_type !== undefined) entity.entryType = dto.entry_type;
    // entry_date is required on this table, so an explicit value always parses — unlike the
    // optional dates below, which clear when sent empty.
    if (dto.entry_date !== undefined)
      entity.entryDate = new Date(dto.entry_date);
    if (dto.period_label !== undefined) entity.periodLabel = dto.period_label;
    if (dto.title !== undefined) entity.title = dto.title;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.weather !== undefined) entity.weather = dto.weather;
    if (dto.manpower_count !== undefined)
      entity.manpowerCount = dto.manpower_count;
    if (dto.equipment_used !== undefined)
      entity.equipmentUsed = dto.equipment_used;
    if (dto.work_accomplished !== undefined)
      entity.workAccomplished = dto.work_accomplished;
    if (dto.issues_encountered !== undefined)
      entity.issuesEncountered = dto.issues_encountered;
    if (dto.reporter_type !== undefined)
      entity.reporterType = dto.reporter_type;
    // GGG-F: WAR fields
    if (dto.war_number !== undefined) entity.warNumber = dto.war_number;
    if (dto.reporting_period_start !== undefined)
      entity.reportingPeriodStart = toDate(dto.reporting_period_start);
    if (dto.reporting_period_end !== undefined)
      entity.reportingPeriodEnd = toDate(dto.reporting_period_end);
    if (dto.personnel_equipment_constraints !== undefined)
      entity.personnelEquipmentConstraints =
        dto.personnel_equipment_constraints;
    if (dto.mitigation_measures !== undefined)
      entity.mitigationMeasures = dto.mitigation_measures;
    if (dto.look_ahead_activities !== undefined)
      entity.lookAheadActivities = dto.look_ahead_activities;
    if (dto.accomplishments !== undefined)
      entity.accomplishments = dto.accomplishments;
    if (dto.signatories !== undefined) entity.signatories = dto.signatories;
    // GGG-F: MPR fields
    if (dto.mpr_number !== undefined) entity.mprNumber = dto.mpr_number;
    if (dto.reporting_period_month !== undefined)
      entity.reportingPeriodMonth = toDate(dto.reporting_period_month);
    if (dto.work_items !== undefined) entity.workItems = dto.work_items;
    if (dto.accomplishment_summary_percent !== undefined)
      entity.accomplishmentSummaryPercent = dto.accomplishment_summary_percent;
    if (dto.percent_time_elapsed !== undefined)
      entity.percentTimeElapsed = dto.percent_time_elapsed;
    if (dto.original_contract_amount !== undefined)
      entity.originalContractAmount = dto.original_contract_amount;
    if (dto.revised_contract_amount !== undefined)
      entity.revisedContractAmount = dto.revised_contract_amount;
    // ZZZ-G: structured Project Concerns list
    if (dto.concerns_list !== undefined)
      entity.concernsList = dto.concerns_list;
    // BBB-C: WAR/MPR financial billing fields
    if (dto.billing_amount_this_period !== undefined)
      entity.billingAmountThisPeriod = dto.billing_amount_this_period;
    if (dto.financial_accomplishment_percent !== undefined)
      entity.financialAccomplishmentPercent =
        dto.financial_accomplishment_percent;
    await this.getEntityManager().flush();
    return entity;
  }

  /**
   * Delete one entry, scoped to its project. Returns the number of rows removed so the
   * caller can tell "deleted" from "no such entry on this project" without a prior read.
   */
  deleteForProject(projectId: string, entryId: string): Promise<number> {
    return this.nativeDelete({ id: entryId, projectId });
  }

  /**
   * DTO to entity, shared by the single and batch create paths so the two cannot drift.
   *
   * The batch path used to write only eleven of these columns, so every WAR and MPR field a
   * client sent through it — war_number, the reporting periods, work_items, concerns_list,
   * the billing amounts — was accepted by validation and then silently dropped, along with
   * createdBy. Both paths take the same CreateTimelineEntryDto, so they now write the same
   * columns from it.
   */
  private buildFromDto(
    projectId: string,
    dto: CreateTimelineEntryDto,
    userId?: string,
  ): ConstructionTimelineEntry {
    // partial: true relaxes create()'s RequiredEntityData, which otherwise demands every
    // non-optional column up front — including id, createdAt, updatedAt and photosCount,
    // all of which the entity or the database already defaults. Filling those in by hand to
    // satisfy the type is actively harmful: id: '' is not a uuid, and an explicit undefined
    // overrides the entity's own default instead of leaving the column alone.
    return this.create(
      {
        projectId,
        entryType: dto.entry_type || 'WEEKLY',
        entryDate: toDate(dto.entry_date),
        periodLabel: dto.period_label,
        title: dto.title,
        description: dto.description,
        weather: dto.weather,
        manpowerCount: dto.manpower_count ?? undefined,
        equipmentUsed: dto.equipment_used,
        workAccomplished: dto.work_accomplished,
        issuesEncountered: dto.issues_encountered,
        reporterType: dto.reporter_type,
        // GGG-F: WAR fields
        warNumber: dto.war_number,
        reportingPeriodStart: toDate(dto.reporting_period_start),
        reportingPeriodEnd: toDate(dto.reporting_period_end),
        personnelEquipmentConstraints: dto.personnel_equipment_constraints,
        mitigationMeasures: dto.mitigation_measures,
        lookAheadActivities: dto.look_ahead_activities,
        accomplishments: dto.accomplishments,
        signatories: dto.signatories,
        // GGG-F: MPR fields
        mprNumber: dto.mpr_number,
        reportingPeriodMonth: toDate(dto.reporting_period_month),
        workItems: dto.work_items,
        accomplishmentSummaryPercent: dto.accomplishment_summary_percent,
        percentTimeElapsed: dto.percent_time_elapsed,
        originalContractAmount: dto.original_contract_amount,
        revisedContractAmount: dto.revised_contract_amount,
        // ZZZ-G: structured Project Concerns list
        concernsList: dto.concerns_list,
        // BBB-C: WAR/MPR financial billing fields
        billingAmountThisPeriod: dto.billing_amount_this_period,
        financialAccomplishmentPercent: dto.financial_accomplishment_percent,
        createdBy: userId,
      },
      { partial: true },
    );
  }
}
