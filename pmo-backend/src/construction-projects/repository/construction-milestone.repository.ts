import { EntityRepository } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { ConstructionMilestone } from '../../database/entities';
import type { CreateMilestoneDto } from '../dto';

/**
 * Parse a DTO date field. The DTOs carry dates as strings; an empty string or null means
 * "no date", which has to stay undefined rather than becoming an Invalid Date.
 */
function toDate(value?: string | null): Date | undefined {
  return value ? new Date(value) : undefined;
}

export class ConstructionMilestoneRepository extends EntityRepository<ConstructionMilestone> {
  /**
   * Every milestone on a project, in schedule order. Both the milestones endpoint and the
   * project detail payload read through here, so the ordering is defined in one place.
   */
  findByProject(projectId: string): Promise<ConstructionMilestone[]> {
    return this.find({ projectId }, { orderBy: { targetDate: 'asc' } });
  }

  /**
   * A single milestone, scoped to its project. The projectId is part of the lookup rather
   * than checked afterwards, so a milestone id from another project simply does not match
   * instead of being found and then rejected.
   */
  findOneForProject(
    projectId: string,
    milestoneId: string,
  ): Promise<ConstructionMilestone | null> {
    return this.findOne({ id: milestoneId, projectId });
  }

  /** Create and persist one milestone. */
  async createForProject(
    projectId: string,
    dto: CreateMilestoneDto,
    userId?: string,
  ): Promise<ConstructionMilestone> {
    const entity = this.buildFromDto(projectId, dto, userId);
    await this.getEntityManager().persist(entity).flush();
    return entity;
  }

  /**
   * LK-C: create a batch of milestones in a single flush, so a failure part-way through
   * leaves none of them behind.
   */
  async createManyForProject(
    projectId: string,
    items: CreateMilestoneDto[],
    userId?: string,
  ): Promise<ConstructionMilestone[]> {
    const entities = items.map((item) =>
      this.buildFromDto(projectId, item, userId),
    );
    await this.getEntityManager().persist(entities).flush();
    return entities;
  }

  /**
   * Apply a partial update. Only the fields the caller actually sent are touched — a field
   * left out of the DTO keeps its stored value, while one sent as null is cleared.
   */
  async updateFromDto(
    entity: ConstructionMilestone,
    dto: Partial<CreateMilestoneDto>,
    userId?: string,
  ): Promise<ConstructionMilestone> {
    if (dto.title !== undefined) entity.title = dto.title;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.target_date !== undefined)
      entity.targetDate = toDate(dto.target_date);
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.remarks !== undefined) entity.remarks = dto.remarks;
    if (dto.start_date !== undefined) entity.startDate = toDate(dto.start_date);
    if (dto.actual_start_date !== undefined)
      entity.actualStartDate = toDate(dto.actual_start_date);
    if (dto.progress !== undefined) entity.progress = String(dto.progress);
    if (dto.category !== undefined) entity.category = dto.category;
    // LI-D: audit
    entity.updatedBy = userId;
    entity.updatedAt = new Date();
    await this.getEntityManager().flush();
    return entity;
  }

  /** Delete one milestone. The caller logs it first, while the title is still readable. */
  async removeMilestone(entity: ConstructionMilestone): Promise<void> {
    await this.getEntityManager().remove(entity).flush();
  }

  /**
   * DTO to entity, shared by the single and batch create paths so the two cannot drift —
   * the defaults below (PENDING, 0.00) are part of that contract.
   */
  private buildFromDto(
    projectId: string,
    dto: CreateMilestoneDto,
    userId?: string,
  ): ConstructionMilestone {
    return this.create({
      projectId,
      title: dto.title,
      description: dto.description,
      targetDate: toDate(dto.target_date),
      status: dto.status || 'PENDING',
      remarks: dto.remarks,
      startDate: toDate(dto.start_date),
      actualStartDate: toDate(dto.actual_start_date),
      progress: dto.progress != null ? String(dto.progress) : '0.00',
      category: dto.category,
      // LI-D: audit
      createdBy: userId,
    });
  }
}
