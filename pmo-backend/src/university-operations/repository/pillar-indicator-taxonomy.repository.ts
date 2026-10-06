import { EntityRepository, QueryOrder } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { PillarIndicatorTaxonomy } from '../../database/entities';

/** The taxonomy fields the indicator write paths validate a request against. */
export interface TaxonomyEntry {
  id: string;
  pillar_type: string;
  indicator_name: string;
}

/** Active taxonomy indicators of one pillar, split by indicator type. */
export interface TaxonomyPillarCounts {
  pillar_type: string;
  total: number;
  outcome_count: number;
  output_count: number;
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

  /**
   * Active indicators per pillar, with the OUTCOME/OUTPUT split.
   *
   * The taxonomy is a small seeded table, so the grouping is done in memory rather than with
   * COUNT(*) FILTER — one query either way, and the counts come back as numbers instead of the
   * strings an aggregate would return.
   */
  async countByPillar(): Promise<TaxonomyPillarCounts[]> {
    const entries = await this.find({ isActive: true }, { filters: false });
    const byPillar = new Map<string, TaxonomyPillarCounts>();
    for (const entry of entries) {
      const row = byPillar.get(entry.pillarType) ?? {
        pillar_type: entry.pillarType,
        total: 0,
        outcome_count: 0,
        output_count: 0,
      };
      row.total++;
      if (entry.indicatorType === 'OUTCOME') row.outcome_count++;
      if (entry.indicatorType === 'OUTPUT') row.output_count++;
      byPillar.set(entry.pillarType, row);
    }
    return [...byPillar.values()].sort((a, b) =>
      a.pillar_type.localeCompare(b.pillar_type),
    );
  }

  /** Active indicators of one pillar, in their defined display order. */
  findActiveForPillar(pillarType: string): Promise<PillarIndicatorTaxonomy[]> {
    return this.find(
      { pillarType, isActive: true },
      { filters: false, orderBy: { indicatorOrder: QueryOrder.ASC } },
    );
  }
}
