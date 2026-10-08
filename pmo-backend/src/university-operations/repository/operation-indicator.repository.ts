import {
  EntityRepository,
  FilterQuery,
  QueryOrder,
  QueryOrderMap,
} from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { OperationIndicator } from '../../database/entities/operation-indicator.entity';
import { assignColumns, toRow } from '../../common/repository/entity-row';

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
  campus: string;
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

const QUARTER_SIDES = [
  {
    value: 'target',
    numerator: 'target_numerator',
    denominator: 'target_denominator',
  },
  {
    value: 'accomplishment',
    numerator: 'numerator',
    denominator: 'denominator',
  },
] as const;

/**
 * One campus's figures for a quarter column, picked out of that campus's rows.
 *
 * A campus files a cumulative snapshot per quarter — its Q4 row repeats Q1, Q2 and Q3 — so the
 * largest value is the latest statement of that quarter. The numerator and denominator are
 * taken from the row that supplied the value rather than maximised on their own, which could
 * otherwise pair one snapshot's numerator with another's denominator.
 */
function campusQuarterColumns(): string {
  return QUARTER_SIDES.flatMap(({ value, numerator, denominator }) =>
    [1, 2, 3, 4].flatMap((q) => [
      `MAX(oi.${value}_q${q}) AS ${value}_q${q}`,
      `(array_agg(oi.${numerator}_q${q} ORDER BY oi.${value}_q${q} DESC NULLS LAST, oi.updated_at DESC))[1] AS ${numerator}_q${q}`,
      `(array_agg(oi.${denominator}_q${q} ORDER BY oi.${value}_q${q} DESC NULLS LAST, oi.updated_at DESC))[1] AS ${denominator}_q${q}`,
    ]),
  ).join(',\n          ');
}

/**
 * A quarter column combined across the campuses that reported it.
 *
 * A count is cumulative, so the campuses add up. A percentage is not: its figure is the summed
 * numerators over the summed denominators, so 2/5 at one campus and 7/10 at another is 9/15 —
 * 60% — rather than 110%. When any reporting campus lacks a fraction that cannot be done, and
 * the mean of the campuses is used instead, which is the closest statement that is not wrong.
 *
 * A quarter only one campus reported passes that campus's figure through untouched. Combining
 * a single campus would otherwise recompute a percentage from its fraction and shift the value
 * in the last decimal places, changing published figures for no reason.
 */
function combinedQuarterColumns(): string {
  return QUARTER_SIDES.flatMap(({ value, numerator, denominator }) =>
    [1, 2, 3, 4].map((q) => {
      const v = `c.${value}_q${q}`;
      const n = `c.${numerator}_q${q}`;
      const d = `c.${denominator}_q${q}`;
      return `CASE
            WHEN COUNT(${v}) <= 1 THEN MAX(${v})
            WHEN c.unit_type = 'PERCENTAGE' THEN
              CASE WHEN COUNT(${v}) = COUNT(CASE WHEN ${v} IS NOT NULL AND ${n} IS NOT NULL AND ${d} > 0 THEN 1 END)
                THEN LEAST(SUM(CASE WHEN ${v} IS NOT NULL THEN ${n} END)
                     / NULLIF(SUM(CASE WHEN ${v} IS NOT NULL THEN ${d} END), 0) * 100, 9999.99)
                ELSE AVG(${v})
              END
            ELSE SUM(${v})
          END AS ${value}_q${q}`;
    }),
  ).join(',\n          ');
}

/**
 * A comma-separated '?' list, one per value, for an IN (...) clause.
 *
 * IN cannot take a single bound array through this driver, so the list of placeholders is
 * built from the array's length — never from its contents. The years themselves are still
 * passed as bound parameters.
 */
function placeholders(values: unknown[]): string {
  return values.map(() => '?').join(', ');
}

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
      campus: indicator.campus,
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
    reportedQuarter: string | undefined,
    campus: string,
  ): Promise<boolean> {
    const count = await this.count(
      {
        pillarIndicatorId,
        operationId,
        fiscalYear,
        reportedQuarter: reportedQuarter ?? null,
        campus,
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
    campus: string,
  ): Promise<IndicatorRow> {
    const indicator = this.create(
      {
        operationId,
        particular,
        createdBy: userId,
        campus,
        // reported_quarter distinguishes a quarter's row from the unpartitioned one, so an
        // empty value has to land as NULL rather than be left unset.
        reportedQuarter: dto.reported_quarter || null,
      },
      { partial: true },
    );
    // campus, like reported_quarter, identifies the row rather than describing it, so neither
    // is taken from the generic column copy.
    assignColumns(this.getEntityManager(), ENTITY, indicator, dto, [
      'particular',
      'reported_quarter',
      'campus',
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

  // ─── Physical-indicator analytics ──────────────────────────────────────────
  //
  // These three stay as SQL. Each opens with DISTINCT ON inside a CTE, which neither find()
  // nor the query builder can express, and the two-stage shape is load-bearing: stage one
  // picks one canonical operation per taxonomy indicator, stage two MAX-aggregates that
  // operation's rows across every reported_quarter. Rewriting them in memory would mean
  // hydrating every indicator row of the fiscal year to recompute what Postgres groups in one
  // pass. They live here rather than in the service so the service holds no SQL, and every
  // value a caller supplies is still a bound parameter.

  /**
   * Per-pillar totals for one fiscal year: how many taxonomy indicators have data, the COUNT
   * and PERCENTAGE aggregates kept apart, and the unit-type-aware accomplishment rate.
   */
  getPillarSummaryAggregate(
    fiscalYear: number,
  ): Promise<Record<string, any>[]> {
    return this.query(
      `
      WITH canonical_ops AS (
        SELECT DISTINCT ON (oi.pillar_indicator_id)
          oi.operation_id, oi.pillar_indicator_id
        FROM operation_indicators oi
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year = ? AND oi.deleted_at IS NULL AND pit.is_active = true
        ORDER BY oi.pillar_indicator_id, oi.updated_at DESC
      ),
      per_campus AS (
        SELECT
          oi.pillar_indicator_id, oi.campus,
          pit.pillar_type, pit.unit_type, pit.indicator_type,
          ${campusQuarterColumns()}
        FROM operation_indicators oi
        JOIN canonical_ops co ON oi.operation_id = co.operation_id
          AND oi.pillar_indicator_id = co.pillar_indicator_id
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year = ? AND oi.deleted_at IS NULL
        GROUP BY oi.pillar_indicator_id, oi.campus, pit.pillar_type, pit.unit_type, pit.indicator_type
      ),
      merged AS (
        SELECT
          c.pillar_indicator_id,
          c.pillar_type, c.unit_type, c.indicator_type,
          ${combinedQuarterColumns()}
        FROM per_campus c
        GROUP BY c.pillar_indicator_id, c.pillar_type, c.unit_type, c.indicator_type
      )
      SELECT
        deduped.pillar_type,
        COUNT(DISTINCT deduped.pillar_indicator_id) AS indicators_with_data,
        SUM(
          CASE WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT')
            THEN COALESCE(deduped.target_q1,0) + COALESCE(deduped.target_q2,0) + COALESCE(deduped.target_q3,0) + COALESCE(deduped.target_q4,0)
            ELSE 0
          END
        ) AS count_target,
        SUM(
          CASE WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT')
            THEN COALESCE(deduped.accomplishment_q1,0) + COALESCE(deduped.accomplishment_q2,0) + COALESCE(deduped.accomplishment_q3,0) + COALESCE(deduped.accomplishment_q4,0)
            ELSE 0
          END
        ) AS count_accomplishment,
        AVG(
          CASE WHEN deduped.unit_type = 'PERCENTAGE' THEN
            (COALESCE(deduped.target_q1,0) + COALESCE(deduped.target_q2,0) + COALESCE(deduped.target_q3,0) + COALESCE(deduped.target_q4,0))
            / NULLIF(
              (CASE WHEN deduped.target_q1 IS NOT NULL THEN 1 ELSE 0 END) +
              (CASE WHEN deduped.target_q2 IS NOT NULL THEN 1 ELSE 0 END) +
              (CASE WHEN deduped.target_q3 IS NOT NULL THEN 1 ELSE 0 END) +
              (CASE WHEN deduped.target_q4 IS NOT NULL THEN 1 ELSE 0 END)
            , 0)
          ELSE NULL END
        ) AS pct_avg_target,
        AVG(
          CASE WHEN deduped.unit_type = 'PERCENTAGE' THEN
            (COALESCE(deduped.accomplishment_q1,0) + COALESCE(deduped.accomplishment_q2,0) + COALESCE(deduped.accomplishment_q3,0) + COALESCE(deduped.accomplishment_q4,0))
            / NULLIF(
              (CASE WHEN deduped.accomplishment_q1 IS NOT NULL THEN 1 ELSE 0 END) +
              (CASE WHEN deduped.accomplishment_q2 IS NOT NULL THEN 1 ELSE 0 END) +
              (CASE WHEN deduped.accomplishment_q3 IS NOT NULL THEN 1 ELSE 0 END) +
              (CASE WHEN deduped.accomplishment_q4 IS NOT NULL THEN 1 ELSE 0 END)
            , 0)
          ELSE NULL END
        ) AS pct_avg_accomplishment,
        COUNT(CASE WHEN deduped.unit_type = 'PERCENTAGE' THEN 1 END) AS pct_indicator_count,
        COUNT(CASE WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT') THEN 1 END) AS count_indicator_count,
        -- Phase GN-2: Unit-type-aware avg accomplishment rate (formula unchanged)
        AVG(
          CASE
            WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT') AND deduped._sum_target > 0
              THEN (deduped._sum_actual / deduped._sum_target) * 100
            WHEN deduped.unit_type = 'PERCENTAGE' AND deduped._filled_target_qs > 0 AND deduped._filled_actual_qs > 0
              THEN (
                (deduped._sum_actual / deduped._filled_actual_qs) /
                NULLIF(deduped._sum_target / deduped._filled_target_qs, 0)
              ) * 100
            ELSE NULL
          END
        ) AS avg_accomplishment_rate,
        SUM(
          CASE WHEN deduped._sum_target > 0 THEN 1.0 ELSE 0 END
        ) AS indicator_target_rate,
        SUM(
          CASE
            WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT') AND deduped._sum_target > 0
              THEN deduped._sum_actual / deduped._sum_target
            WHEN deduped.unit_type = 'PERCENTAGE' AND deduped._filled_target_qs > 0 AND deduped._filled_actual_qs > 0
              THEN (deduped._sum_actual / deduped._filled_actual_qs) /
                   NULLIF(deduped._sum_target / deduped._filled_target_qs, 0)
            ELSE NULL
          END
        ) AS indicator_actual_rate
      FROM (
        SELECT
          merged.*,
          (COALESCE(merged.target_q1,0)+COALESCE(merged.target_q2,0)+COALESCE(merged.target_q3,0)+COALESCE(merged.target_q4,0)) AS _sum_target,
          (COALESCE(merged.accomplishment_q1,0)+COALESCE(merged.accomplishment_q2,0)+COALESCE(merged.accomplishment_q3,0)+COALESCE(merged.accomplishment_q4,0)) AS _sum_actual,
          -- A quarter recorded as 0 counts toward the divisor: it is reported data, not a
          -- blank, and the numerators above already include it through COALESCE.
          (CASE WHEN merged.target_q1 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q2 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q3 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q4 IS NOT NULL THEN 1 ELSE 0 END) AS _filled_target_qs,
          (CASE WHEN merged.accomplishment_q1 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q2 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q3 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q4 IS NOT NULL THEN 1 ELSE 0 END) AS _filled_actual_qs
        FROM merged
      ) AS deduped
      GROUP BY deduped.pillar_type
    `,
      [fiscalYear, fiscalYear],
    );
  }

  /**
   * Per-pillar, per-quarter target and actual rates for one fiscal year, optionally narrowed
   * to a single pillar. The narrowing is applied inside canonical_ops so the deduplication
   * happens within the chosen pillar, not across all of them.
   */
  getQuarterlyTrendAggregate(
    fiscalYear: number,
    pillarType?: string,
  ): Promise<Record<string, any>[]> {
    const pillarFilter = pillarType ? 'AND pit.pillar_type = ?' : '';
    const params: any[] = [fiscalYear];
    if (pillarType) params.push(pillarType);
    // The second fiscal year binds the merged stage's own WHERE clause.
    params.push(fiscalYear);

    return this.query(
      `
      WITH canonical_ops AS (
        SELECT DISTINCT ON (oi.pillar_indicator_id)
          oi.operation_id, oi.pillar_indicator_id
        FROM operation_indicators oi
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year = ? AND oi.deleted_at IS NULL AND pit.is_active = true
        ${pillarFilter}
        ORDER BY oi.pillar_indicator_id, oi.updated_at DESC
      ),
      per_campus AS (
        SELECT
          oi.pillar_indicator_id, oi.campus,
          pit.pillar_type, pit.unit_type,
          ${campusQuarterColumns()}
        FROM operation_indicators oi
        JOIN canonical_ops co ON oi.operation_id = co.operation_id
          AND oi.pillar_indicator_id = co.pillar_indicator_id
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year = ? AND oi.deleted_at IS NULL
        GROUP BY oi.pillar_indicator_id, oi.campus, pit.pillar_type, pit.unit_type
      ),
      deduped AS (
        SELECT
          c.pillar_indicator_id,
          c.pillar_type, c.unit_type,
          ${combinedQuarterColumns()}
        FROM per_campus c
        GROUP BY c.pillar_indicator_id, c.pillar_type, c.unit_type
      )
      SELECT
        -- Phase AAAG-A: per-pillar grouping (one row per pillar)
        deduped.pillar_type,
        SUM(CASE WHEN deduped.target_q1 > 0 THEN 1.0 ELSE 0 END) AS target_rate_q1,
        SUM(CASE WHEN deduped.target_q2 > 0 THEN 1.0 ELSE 0 END) AS target_rate_q2,
        SUM(CASE WHEN deduped.target_q3 > 0 THEN 1.0 ELSE 0 END) AS target_rate_q3,
        SUM(CASE WHEN deduped.target_q4 > 0 THEN 1.0 ELSE 0 END) AS target_rate_q4,
        SUM(CASE WHEN deduped.target_q1 > 0 THEN COALESCE(deduped.accomplishment_q1,0)/deduped.target_q1 ELSE NULL END) AS actual_rate_q1,
        SUM(CASE WHEN deduped.target_q2 > 0 THEN COALESCE(deduped.accomplishment_q2,0)/deduped.target_q2 ELSE NULL END) AS actual_rate_q2,
        SUM(CASE WHEN deduped.target_q3 > 0 THEN COALESCE(deduped.accomplishment_q3,0)/deduped.target_q3 ELSE NULL END) AS actual_rate_q3,
        SUM(CASE WHEN deduped.target_q4 > 0 THEN COALESCE(deduped.accomplishment_q4,0)/deduped.target_q4 ELSE NULL END) AS actual_rate_q4
      FROM deduped
      GROUP BY deduped.pillar_type
    `,
      params,
    );
  }

  /** Totals per fiscal year across every pillar. */
  getYearlyTotals(years: number[]): Promise<Record<string, any>[]> {
    if (years.length === 0) return Promise.resolve([]);
    const yqs = placeholders(years);
    return this.query(
      `
      WITH canonical_ops AS (
        SELECT DISTINCT ON (oi.fiscal_year, oi.pillar_indicator_id)
          oi.operation_id, oi.pillar_indicator_id, oi.fiscal_year
        FROM operation_indicators oi
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year IN (${yqs}) AND oi.deleted_at IS NULL AND pit.is_active = true
        ORDER BY oi.fiscal_year, oi.pillar_indicator_id, oi.updated_at DESC
      ),
      per_campus AS (
        SELECT
          oi.pillar_indicator_id, oi.campus, oi.fiscal_year, pit.unit_type,
          ${campusQuarterColumns()}
        FROM operation_indicators oi
        JOIN canonical_ops co ON oi.operation_id = co.operation_id
          AND oi.pillar_indicator_id = co.pillar_indicator_id
          AND oi.fiscal_year = co.fiscal_year
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year IN (${yqs}) AND oi.deleted_at IS NULL
        GROUP BY oi.pillar_indicator_id, oi.campus, oi.fiscal_year, pit.unit_type
      ),
      merged AS (
        SELECT
          c.pillar_indicator_id, c.fiscal_year, c.unit_type,
          ${combinedQuarterColumns()}
        FROM per_campus c
        GROUP BY c.pillar_indicator_id, c.fiscal_year, c.unit_type
      )
      SELECT
        deduped.fiscal_year,
        COUNT(*) AS total_indicators,
        AVG(
          CASE
            WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT') AND deduped._sum_target > 0
              THEN (deduped._sum_actual / deduped._sum_target) * 100
            WHEN deduped.unit_type = 'PERCENTAGE' AND deduped._filled_target_qs > 0 AND deduped._filled_actual_qs > 0
              THEN ((deduped._sum_actual / deduped._filled_actual_qs) /
                    NULLIF(deduped._sum_target / deduped._filled_target_qs, 0)) * 100
            ELSE NULL
          END
        ) AS avg_accomplishment_rate
      FROM (
        SELECT
          merged.*,
          (COALESCE(merged.target_q1,0)+COALESCE(merged.target_q2,0)+COALESCE(merged.target_q3,0)+COALESCE(merged.target_q4,0)) AS _sum_target,
          (COALESCE(merged.accomplishment_q1,0)+COALESCE(merged.accomplishment_q2,0)+COALESCE(merged.accomplishment_q3,0)+COALESCE(merged.accomplishment_q4,0)) AS _sum_actual,
          -- A quarter recorded as 0 counts toward the divisor: it is reported data, not a
          -- blank, and the numerators above already include it through COALESCE.
          (CASE WHEN merged.target_q1 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q2 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q3 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q4 IS NOT NULL THEN 1 ELSE 0 END) AS _filled_target_qs,
          (CASE WHEN merged.accomplishment_q1 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q2 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q3 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q4 IS NOT NULL THEN 1 ELSE 0 END) AS _filled_actual_qs
        FROM merged
      ) AS deduped
      GROUP BY deduped.fiscal_year
      ORDER BY deduped.fiscal_year
    `,
      [...years, ...years],
    );
  }

  /** The same totals, broken down by pillar. */
  getYearlyByPillar(years: number[]): Promise<Record<string, any>[]> {
    if (years.length === 0) return Promise.resolve([]);
    const yqs = placeholders(years);
    return this.query(
      `
      WITH canonical_ops AS (
        SELECT DISTINCT ON (oi.fiscal_year, oi.pillar_indicator_id)
          oi.operation_id, oi.pillar_indicator_id, oi.fiscal_year
        FROM operation_indicators oi
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year IN (${yqs}) AND oi.deleted_at IS NULL AND pit.is_active = true
        ORDER BY oi.fiscal_year, oi.pillar_indicator_id, oi.updated_at DESC
      ),
      per_campus AS (
        SELECT
          oi.pillar_indicator_id, oi.campus, oi.fiscal_year, pit.pillar_type, pit.unit_type,
          ${campusQuarterColumns()}
        FROM operation_indicators oi
        JOIN canonical_ops co ON oi.operation_id = co.operation_id
          AND oi.pillar_indicator_id = co.pillar_indicator_id
          AND oi.fiscal_year = co.fiscal_year
        JOIN pillar_indicator_taxonomy pit ON oi.pillar_indicator_id = pit.id
        WHERE oi.fiscal_year IN (${yqs}) AND oi.deleted_at IS NULL
        GROUP BY oi.pillar_indicator_id, oi.campus, oi.fiscal_year, pit.pillar_type, pit.unit_type
      ),
      merged AS (
        SELECT
          c.pillar_indicator_id, c.fiscal_year, c.pillar_type, c.unit_type,
          ${combinedQuarterColumns()}
        FROM per_campus c
        GROUP BY c.pillar_indicator_id, c.fiscal_year, c.pillar_type, c.unit_type
      )
      SELECT
        deduped.fiscal_year,
        deduped.pillar_type,
        AVG(
          CASE
            WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT') AND deduped._sum_target > 0
              THEN (deduped._sum_actual / deduped._sum_target) * 100
            WHEN deduped.unit_type = 'PERCENTAGE' AND deduped._filled_target_qs > 0 AND deduped._filled_actual_qs > 0
              THEN ((deduped._sum_actual / deduped._filled_actual_qs) /
                    NULLIF(deduped._sum_target / deduped._filled_target_qs, 0)) * 100
            ELSE NULL
          END
        ) AS avg_accomplishment_rate,
        AVG(CASE WHEN deduped.unit_type = 'PERCENTAGE'
          THEN deduped._sum_target / NULLIF(deduped._filled_target_qs, 0)
          ELSE NULL END) AS pct_avg_target,
        AVG(CASE WHEN deduped.unit_type = 'PERCENTAGE'
          THEN deduped._sum_actual / NULLIF(deduped._filled_actual_qs, 0)
          ELSE NULL END) AS pct_avg_accomplishment,
        SUM(CASE WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT')
          THEN deduped._sum_target ELSE 0 END) AS count_target,
        SUM(CASE WHEN deduped.unit_type IN ('COUNT', 'WEIGHTED_COUNT')
          THEN deduped._sum_actual ELSE 0 END) AS count_accomplishment
      FROM (
        SELECT
          merged.*,
          (COALESCE(merged.target_q1,0)+COALESCE(merged.target_q2,0)+COALESCE(merged.target_q3,0)+COALESCE(merged.target_q4,0)) AS _sum_target,
          (COALESCE(merged.accomplishment_q1,0)+COALESCE(merged.accomplishment_q2,0)+COALESCE(merged.accomplishment_q3,0)+COALESCE(merged.accomplishment_q4,0)) AS _sum_actual,
          -- A quarter recorded as 0 counts toward the divisor: it is reported data, not a
          -- blank, and the numerators above already include it through COALESCE.
          (CASE WHEN merged.target_q1 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q2 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q3 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.target_q4 IS NOT NULL THEN 1 ELSE 0 END) AS _filled_target_qs,
          (CASE WHEN merged.accomplishment_q1 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q2 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q3 IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN merged.accomplishment_q4 IS NOT NULL THEN 1 ELSE 0 END) AS _filled_actual_qs
        FROM merged
      ) AS deduped
      GROUP BY deduped.fiscal_year, deduped.pillar_type
      ORDER BY deduped.fiscal_year, deduped.pillar_type
    `,
      [...years, ...years],
    );
  }

  /**
   * Run one of the statements above. Every caller value arrives as a bound '?' parameter; the
   * only text spliced into a statement is the fixed pillar filter fragment, which carries its
   * own placeholder rather than a value.
   */
  private query(
    statement: string,
    params: any[],
  ): Promise<Record<string, any>[]> {
    const em = this.getEntityManager();
    // The transaction context is passed so these statements run on the same connection as the
    // surrounding work. Without it they take their own connection and cannot see anything the
    // open transaction has written — a caller that inserts and then aggregates would read
    // figures that silently predate its own insert.
    return em
      .getConnection()
      .execute(statement, params, 'all', em.getTransactionContext());
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private row(indicator: OperationIndicator): IndicatorRow {
    return toRow(this.getEntityManager(), ENTITY, indicator);
  }
}
