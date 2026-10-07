import { EntityRepository } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { OperationOrganizationalInfo } from '../../database/entities';
import { toRow } from '../../common/repository/entity-row';

const ENTITY = 'OperationOrganizationalInfo';

export class OperationOrganizationInfoRepository extends EntityRepository<OperationOrganizationalInfo> {
  /**
   * The organizational info attached to one operation, in the snake_case column shape the
   * endpoint has always returned, or null when none has been recorded yet.
   */
  async findForOperation(
    operationId: string,
  ): Promise<Record<string, any> | null> {
    const info = await this.findOne(
      { operationId, deletedAt: null },
      { filters: false },
    );
    return info ? toRow(this.getEntityManager(), ENTITY, info) : null;
  }
}
