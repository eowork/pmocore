import { ConstructionProgressReport } from '../../database/entities';
import { EntityRepository } from '@mikro-orm/core';

export class ConstructionProgressReportRepository extends EntityRepository<ConstructionProgressReport> {
  /** A project's progress reports, newest report date first. */
  findByProject(projectId: string): Promise<ConstructionProgressReport[]> {
    return this.find({ projectId }, { orderBy: { reportDate: 'desc' } });
  }

  /** One progress report, scoped to its project. */
  findOneForProject(
    projectId: string,
    reportId: string,
  ): Promise<ConstructionProgressReport | null> {
    return this.findOne({ id: reportId, projectId });
  }

  /** The most recent report, or null when the project has none. */
  findLatest(projectId: string): Promise<ConstructionProgressReport | null> {
    return this.findOne({ projectId }, { orderBy: { reportDate: 'desc' } });
  }
}
