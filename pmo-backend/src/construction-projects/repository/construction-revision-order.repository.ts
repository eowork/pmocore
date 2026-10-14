import { EntityRepository, QueryOrder } from '@mikro-orm/core';
import { ConstructionRevisionOrder } from '../../database/entities';

export class ConstructionRevisionOrderRepository extends EntityRepository<ConstructionRevisionOrder> {
  /**
   * A project's revision orders, newest first. Both the list endpoint and the mirror below
   * read in this order, so it is defined once here.
   */
  findByProject(projectId: string): Promise<ConstructionRevisionOrder[]> {
    return this.find(
      { projectId },
      {
        orderBy: [
          { revisionDate: QueryOrder.DESC, revisionNumber: QueryOrder.DESC },
        ],
      },
    );
  }

  /** One revision order, scoped to its project. */
  findOneForProject(
    projectId: string,
    roId: string,
  ): Promise<ConstructionRevisionOrder | null> {
    return this.findOne({ id: roId, projectId });
  }

  /** The most recent APPROVED revision, or null when the project has none. */
  findLatestApproved(
    projectId: string,
  ): Promise<ConstructionRevisionOrder | null> {
    return this.findOne(
      { projectId, approvalStatus: 'APPROVED' },
      {
        orderBy: [
          { revisionDate: QueryOrder.DESC, revisionNumber: QueryOrder.DESC },
        ],
      },
    );
  }

  /**
   * The next revision_number for a project. Numbers are per project and gap-free from 1,
   * so they are derived from the current maximum rather than from a sequence.
   */
  async nextRevisionNumber(projectId: string): Promise<number> {
    const rows = await this.getEntityManager()
      .getConnection()
      .execute<
        Array<{ max: number | string | null }>
      >(`SELECT COALESCE(MAX(revision_number), 0) AS max FROM construction_revision_orders WHERE project_id = ?`, [projectId]);
    return Number(rows[0]?.max ?? 0) + 1;
  }
}
