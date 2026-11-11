import type { ConstructionDocumentType } from '../../database/entities';
import { EntityRepository, FilterQuery, QueryOrder } from '@mikro-orm/core';

/** Escape LIKE metacharacters so user input is matched literally (Postgres default escape is `\`). */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export class ConstructionDocumentTypeRepository extends EntityRepository<ConstructionDocumentType> {
  /**
   * @param search   Case-insensitive substring matched against group label, type code OR type label.
   * @param isActive When true, only active types are returned. False/omitted applies no filter.
   */
  findAllDocumentType(search?: string, isActive?: boolean) {
    const where: FilterQuery<ConstructionDocumentType> = {};

    const term = search?.trim();
    if (term) {
      const pattern = `%${escapeLike(term)}%`;
      where.$or = [
        { groupLabel: { $ilike: pattern } },
        { typeCode: { $ilike: pattern } },
        { typeLabel: { $ilike: pattern } },
      ];
    }

    if (isActive === true) {
      where.isActive = true;
    }

    return this.findAll({
      where,
      orderBy: { groupCode: QueryOrder.ASC, sortOrder: QueryOrder.ASC },
    });
  }
}
