import {
  EntityRepository,
  FilterQuery,
  QueryOrder,
  QueryOrderMap,
} from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { OperationIndicator } from '../../database/entities/operation-indicator.entity';
import { assignColumns, toRow } from './entity-row';

const ENTITY = 'OperationIndicator';

/** A row carrying the operation_indicators columns plus whatever a query joined onto them. */
export type IndicatorRow = Record<string, any>;

/** The context the quarterly update path validates against before writing anything. */
export interface IndicatorContext {
  id: string;
  fiscal_year: number;
  pillar_indicator_id: string | null;
  operation_id: string;
  particular: string;
  pillar_type: string | null;
  indicator_name: string | null;
  operation_type: string;
}

/** One row of the orphan-by-pillar diagnostic. */
export interface OrphansByPillar {
  pillar_type: string;
  count: number;
}

/** Indicators with no taxonomy link, listed for admin review. */
export interface OrphanIndicatorRow {
  id: string;
  operation_id: string;
  particular: string;
  fiscal_year: number;
  created_at: Date;
  updated_at: Date;
  remarks: string | null;
  target_q1: string | null;
  target_q2: string | null;
  target_q3: string | null;
  target_q4: string | null;
  accomplishment_q1: string | null;
  accomplishment_q2: string | null;
  accomplishment_q3: string | null;
  accomplishment_q4: string | null;
  operation_title: string;
  operation_type: string;
  has_quarterly_data: boolean;
}

/**
 * The taxonomy's indicator_order first, then the caller's own keys, then `id`.
 *
 * Sorted by the database rather than in memory. `particular` is a text column and Postgres
 * orders it under the database collation, which does not agree with JavaScript's
 * localeCompare on strings differing only in case — there are live rows called both
 * "Number of research" and "Number of Research".
 *
 * The raw statements opened with COALESCE(pit.indicator_order, 999); an orphan has no taxonomy
 * row, so its joined order is NULL, and Postgres sorts NULLs last on ASC. The highest real
 * indicator_order is 4, so "NULL last" and "999 last" place the same rows in the same spot.
 *
 * `id` is a final tiebreaker: the same taxonomy indicator appears once per quarter, so most
 * rows share every other key and their relative order was previously whatever the plan
 * happened to produce — a row could move between pages run to run.
 */
const TAXONOMY_ORDER_THEN = (
  then: QueryOrderMap<OperationIndicator>,
): QueryOrderMap<OperationIndicator>[] => [
  { taxonomy: { indicatorOrder: 'asc' } },
  then,
  { id: 'asc' },
];

const PILLAR_TYPES = [
  'HIGHER_EDUCATION',
  'ADVANCED_EDUCATION',
  'RESEARCH',
  'TECHNICAL_ADVISORY',
];

export class OperationIndicatorRepository extends EntityRepository<OperationIndicator> {
  // ─── Reads ─────────────────────────────────────────────────────────────────

  /** Every live indicator on one operation, newest fiscal year first. */
  async findForOperation(operationId: string): Promise<IndicatorRow[]> {
    const indicators = await this.find(
      { operationId, deletedAt: null },
      { filters: false, orderBy: { fiscalYear: QueryOrder.DESC } },
    );
    return indicators.map((i) => this.row(i));
  }

  /**
   * Indicators on one operation with their taxonomy metadata attached under the `taxonomy_*`
   * aliases the list endpoint has always used.
   *
   * The taxonomy relation is populated rather than joined by hand, and it is optional, so an
   * orphaned indicator still comes back — which is what the LEFT JOIN was for.
   */
  async findForOperationWithTaxonomy(
    operationId: string,
    fiscalYear?: number,
  ): Promise<IndicatorRow[]> {
    const where: FilterQuery<OperationIndicator> = {
      operationId,
      deletedAt: null,
    };
    if (fiscalYear) Object.assign(where, { fiscalYear });

    const indicators = await this.find(where, {
      populate: ['taxonomy'] as any,
      filters: false,
      orderBy: TAXONOMY_ORDER_THEN({
        fiscalYear: QueryOrder.DESC,
        createdAt: QueryOrder.DESC,
      }),
    });

    return indicators.map((i) => ({
      ...this.row(i),
      taxonomy_name: i.taxonomy?.indicatorName ?? null,
      taxonomy_code: i.taxonomy?.indicatorCode ?? null,
      taxonomy_uacs: i.taxonomy?.uacsCode ?? null,
      unit_type: i.taxonomy?.unitType ?? null,
      taxonomy_description: i.taxonomy?.description ?? null,
    }));
  }

  /**
   * Every indicator for one pillar and fiscal year, across all operations of that pillar.
   *
   * The pillar is matched on the owning operation's type. The taxonomy's own pillar_type was
   * also checked, with `OR pit.pillar_type IS NULL` to let orphans through; an orphan has no
   * taxonomy at all here, so the condition is expressed as "no taxonomy, or a matching one".
   */
  async findByPillarAndYear(
    pillarType: string,
    fiscalYear: number,
    quarter?: string,
  ): Promise<IndicatorRow[]> {
    if (!PILLAR_TYPES.includes(pillarType)) return [];

    const where: FilterQuery<OperationIndicator> = {
      fiscalYear,
      deletedAt: null,
      operation: { operationType: pillarType, deletedAt: null },
      $or: [{ taxonomy: null }, { taxonomy: { pillarType } }],
    };
    if (quarter && ['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter)) {
      Object.assign(where, {
        $and: [
          { $or: [{ reportedQuarter: quarter }, { reportedQuarter: null }] },
        ],
      });
    }

    const indicators = await this.find(where, {
      populate: ['taxonomy'] as any,
      filters: false,
      orderBy: TAXONOMY_ORDER_THEN({ particular: QueryOrder.ASC }),
    });

    return indicators.map((i) => ({
      ...this.row(i),
      indicator_name: i.taxonomy?.indicatorName ?? null,
      indicator_code: i.taxonomy?.indicatorCode ?? null,
      uacs_code: i.taxonomy?.uacsCode ?? null,
      unit_type: i.taxonomy?.unitType ?? null,
      indicator_type: i.taxonomy?.indicatorType ?? null,
      description: i.taxonomy?.description ?? null,
    }));
  }

  /**
   * One indicator with the four taxonomy fields the quarterly endpoints return alongside it.
   * Null when the indicator does not exist. Soft-deleted rows are included, matching the
   * previous `WHERE oi.id = ?` with no deleted_at condition.
   */
  async findEnriched(indicatorId: string): Promise<IndicatorRow | null> {
    const indicator = await this.findOne(
      { id: indicatorId },
      { populate: ['taxonomy'] as any, filters: false },
    );
    if (!indicator) return null;
    return {
      ...this.row(indicator),
      indicator_name: indicator.taxonomy?.indicatorName ?? null,
      indicator_code: indicator.taxonomy?.indicatorCode ?? null,
      uacs_code: indicator.taxonomy?.uacsCode ?? null,
      unit_type: indicator.taxonomy?.unitType ?? null,
    };
  }

  /** One indicator's own columns, soft-deleted rows included. */
  async findPlain(indicatorId: string): Promise<IndicatorRow | null> {
    const indicator = await this.findOne(
      { id: indicatorId },
      { filters: false },
    );
    return indicator ? this.row(indicator) : null;
  }

  /**
   * The validation context for a quarterly update: the indicator, its taxonomy's pillar type
   * and the owning operation's type, so the caller can reject a pillar mismatch. Null when the
   * indicator does not belong to that operation.
   */
  async findContext(
    indicatorId: string,
    operationId: string,
  ): Promise<IndicatorContext | null> {
    const indicator = await this.findOne(
      { id: indicatorId, operationId, deletedAt: null },
      { populate: ['taxonomy', 'operation'], filters: false },
    );
    if (!indicator) return null;
    return {
      id: indicator.id,
      fiscal_year: indicator.fiscalYear,
      pillar_indicator_id: indicator.pillarIndicatorId ?? null,
      operation_id: indicator.operationId,
      particular: indicator.particular,
      pillar_type: indicator.taxonomy?.pillarType ?? null,
      indicator_name: indicator.taxonomy?.indicatorName ?? null,
      operation_type: indicator.operation.operationType,
    };
  }

  /** A short sample of an operation's indicators, for the 404 diagnostic log. */
  async findSampleForOperation(
    operationId: string,
    limit = 10,
  ): Promise<IndicatorRow[]> {
    const indicators = await this.find(
      { operationId, deletedAt: null },
      { filters: false, limit },
    );
    return indicators.map((i) => this.row(i));
  }

  /**
   * Whether quarterly data already exists for this taxonomy indicator, operation and fiscal
   * year. `reportedQuarter` undefined means the unpartitioned row, which is a distinct slot
   * from any quarter's — hence the explicit IS NULL rather than leaving the key out.
   */
  async quarterlyDataExists(
    pillarIndicatorId: string,
    operationId: string,
    fiscalYear: number,
    reportedQuarter?: string,
  ): Promise<boolean> {
    const count = await this.count(
      {
        pillarIndicatorId,
        operationId,
        fiscalYear,
        reportedQuarter: reportedQuarter ?? null,
        deletedAt: null,
      },
      { filters: false },
    );
    return count > 0;
  }

  /** Whether an indicator exists on an operation and is not soft-deleted. */
  async existsInOperation(
    indicatorId: string,
    operationId: string,
  ): Promise<boolean> {
    const count = await this.count(
      { id: indicatorId, operationId, deletedAt: null },
      { filters: false },
    );
    return count > 0;
  }

  // ─── Diagnostics ───────────────────────────────────────────────────────────

  /** Live indicators in total, and how many of them are linked to the taxonomy. */
  async countTotalAndLinked(): Promise<{ total: number; linked: number }> {
    const total = await this.count({ deletedAt: null }, { filters: false });
    const linked = await this.count(
      { deletedAt: null, pillarIndicatorId: { $ne: null } },
      { filters: false },
    );
    return { total, linked };
  }

  /**
   * Orphaned indicators grouped by the pillar of their owning operation. Grouped in memory
   * rather than with a GROUP BY: an orphan is a data defect, the set is small by definition,
   * and the rows are needed hydrated by findOrphans() anyway.
   */
  async countOrphansByPillar(): Promise<OrphansByPillar[]> {
    const orphans = await this.find(
      { deletedAt: null, pillarIndicatorId: null },
      { populate: ['operation'] as any, filters: false },
    );
    const counts = new Map<string, number>();
    for (const o of orphans) {
      const pillar = o.operation.operationType;
      counts.set(pillar, (counts.get(pillar) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([pillar_type, count]) => ({ pillar_type, count }))
      .sort((a, b) => a.pillar_type.localeCompare(b.pillar_type));
  }

  /** Full orphan records with their operation's title, for admin review. */
  async findOrphans(): Promise<OrphanIndicatorRow[]> {
    const orphans = await this.find(
      { deletedAt: null, pillarIndicatorId: null },
      { populate: ['operation'] as any, filters: false },
    );

    return orphans
      .map((o) => {
        const row = this.row(o);
        const quarterly = [
          row.target_q1,
          row.target_q2,
          row.target_q3,
          row.target_q4,
          row.accomplishment_q1,
          row.accomplishment_q2,
          row.accomplishment_q3,
          row.accomplishment_q4,
        ];
        return {
          id: row.id,
          operation_id: row.operation_id,
          particular: row.particular,
          fiscal_year: row.fiscal_year,
          created_at: row.created_at,
          updated_at: row.updated_at,
          remarks: row.remarks,
          target_q1: row.target_q1,
          target_q2: row.target_q2,
          target_q3: row.target_q3,
          target_q4: row.target_q4,
          accomplishment_q1: row.accomplishment_q1,
          accomplishment_q2: row.accomplishment_q2,
          accomplishment_q3: row.accomplishment_q3,
          accomplishment_q4: row.accomplishment_q4,
          operation_title: o.operation.title,
          operation_type: o.operation.operationType,
          has_quarterly_data: quarterly.some((v) => v !== null),
        };
      })
      .sort(
        (a, b) =>
          b.fiscal_year - a.fiscal_year ||
          a.operation_type.localeCompare(b.operation_type) ||
          a.particular.localeCompare(b.particular),
      );
  }

  // ─── Writes ────────────────────────────────────────────────────────────────

  /**
   * Insert quarterly data for a taxonomy-linked indicator. `particular` is taken from the
   * taxonomy rather than the request, as the INSERT did.
   */
  async createQuarterlyData(
    operationId: string,
    dto: Record<string, any>,
    particular: string,
    userId: string,
  ): Promise<IndicatorRow> {
    const indicator = this.create(
      {
        operationId,
        particular,
        createdBy: userId,
        // reported_quarter distinguishes a quarter's row from the unpartitioned one, so an
        // empty value has to land as NULL rather than be left unset.
        reportedQuarter: dto.reported_quarter || null,
      },
      { partial: true },
    );
    assignColumns(this.getEntityManager(), ENTITY, indicator, dto, [
      'particular',
      'reported_quarter',
    ]);
    await this.getEntityManager().persist(indicator).flush();
    return this.row(indicator);
  }

  /** Insert a free-form indicator — the pre-taxonomy shape, still used by the generic route. */
  async createIndicator(
    operationId: string,
    dto: Record<string, any>,
    userId: string,
  ): Promise<IndicatorRow> {
    const indicator = this.create(
      { operationId, createdBy: userId, particular: dto.particular },
      { partial: true },
    );
    assignColumns(this.getEntityManager(), ENTITY, indicator, dto, [
      'particular',
    ]);
    await this.getEntityManager().persist(indicator).flush();
    return this.row(indicator);
  }

  /**
   * Write the supplied columns onto an indicator. Returns the column names that were written,
   * so the caller can log exactly what changed; keys that are not columns are ignored rather
   * than interpolated into a SET clause.
   */
  async applyUpdate(
    indicatorId: string,
    dto: Record<string, any>,
    userId: string,
    skip: readonly string[] = [],
  ): Promise<string[] | null> {
    const indicator = await this.findOne(
      { id: indicatorId },
      { filters: false },
    );
    if (!indicator) return null;

    const { applied } = assignColumns(
      this.getEntityManager(),
      ENTITY,
      indicator,
      dto,
      skip,
    );
    indicator.updatedBy = userId;
    await this.getEntityManager().flush();
    return applied;
  }

  /** Soft-delete one indicator of one operation. Returns the rows affected (0 or 1). */
  softDelete(
    indicatorId: string,
    operationId: string,
    userId: string,
  ): Promise<number> {
    return this.nativeUpdate(
      { id: indicatorId, operationId, deletedAt: null },
      { deletedAt: new Date(), deletedBy: userId },
    );
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private row(indicator: OperationIndicator): IndicatorRow {
    return toRow(this.getEntityManager(), ENTITY, indicator);
  }
}
