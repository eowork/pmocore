import { EntityRepository } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { PillarIndicatorTaxonomy } from '../../database/entities/pillar-indicator-taxonomy.entity';

/** The taxonomy fields the indicator write paths validate a request against. */
export interface TaxonomyEntry {
  id: string;
  pillar_type: string;
  indicator_name: string;
}

export class PillarIndicatorTaxonomyRepository extends EntityRepository<PillarIndicatorTaxonomy> {
  /**
   * One active taxonomy indicator by id, or null. Retired entries (is_active false) are not
   * returned, so a request naming one is rejected the same way an unknown id is.
   */
  async findActiveById(id: string): Promise<TaxonomyEntry | null> {
    const entry = await this.findOne(
      { id, isActive: true },
      { filters: false },
    );
    if (!entry) return null;
    return {
      id: entry.id,
      pillar_type: entry.pillarType,
      indicator_name: entry.indicatorName,
    };
  }

  /** Active indicators of one pillar, in their defined display order. */
  findActiveForPillar(pillarType: string): Promise<PillarIndicatorTaxonomy[]> {
    return this.find(
      { pillarType, isActive: true },
      { filters: false, orderBy: { indicatorOrder: 'asc' } },
    );
  }
}
