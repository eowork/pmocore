import { EntityRepository } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { Project } from '../../database/entities/project.entity';

/** The fields a construction project supplies when it creates its parent projects row. */
export interface NewConstructionProject {
  id: string;
  projectCode: string;
  title: string;
  description?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  status: string;
  budget?: number | string | null;
  campus: string;
  createdBy: string;
}

export class ProjectRepository extends EntityRepository<Project> {
  /**
   * Create the parent `projects` row that a construction project hangs off.
   *
   * project_type is fixed to CONSTRUCTION: this is the only caller, and the row exists to give
   * the construction project a place in the cross-module project list.
   *
   * A duplicate project_code surfaces as a UniqueConstraintViolationException on flush, which
   * the caller turns into a 409. The partial unique index projects_project_code_active_idx
   * enforces that among non-deleted rows.
   */
  async createForConstruction(
    project: NewConstructionProject,
  ): Promise<Project> {
    const entity = this.create(
      {
        id: project.id,
        projectCode: project.projectCode,
        title: project.title,
        description: project.description ?? undefined,
        projectType: 'CONSTRUCTION',
        startDate: toDate(project.startDate),
        endDate: toDate(project.endDate),
        status: project.status,
        budget: toDecimal(project.budget),
        campus: project.campus,
        createdBy: project.createdBy,
      },
      // partial: true — created_at and updated_at are filled by the database or the entity's
      // own defaults, and create() would otherwise demand them.
      { partial: true },
    );
    await this.getEntityManager().persist(entity).flush();
    return entity;
  }

  /** Soft-delete. Returns the number of rows affected (0 when the id does not exist). */
  softDelete(id: string, userId: string): Promise<number> {
    return this.nativeUpdate(
      { id },
      { deletedAt: new Date(), deletedBy: userId },
    );
  }
}

/**
 * numeric columns are mapped to string so no centavos are lost to float rounding, and the
 * driver returns them that way. A number arriving from a DTO is converted rather than passed
 * through, which would be a type error and would round-trip differently.
 */
function toDecimal(value?: number | string | null): string | undefined {
  if (value === null || value === undefined) return undefined;
  return typeof value === 'string' ? value : value.toFixed(2);
}

function toDate(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
}
