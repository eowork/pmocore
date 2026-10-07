import { EntityRepository, QueryOrder, raw } from '@mikro-orm/postgresql';
import type { FilterQuery } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { OperationFinancial } from '../../database/entities/operation-financial.entity';
import { assignColumns, toRow } from '../../common/repository/entity-row';

const ENTITY = 'OperationFinancial';

/** A row carrying the operation_financials columns under their snake_case names. */
export type FinancialRow = Record<string, any>;

/** The identifying fields the governance checks read before a write is allowed. */
export interface FinancialKey {
  id: string;
  fiscal_year: number;
  quarter: string | null;
}

export interface FinancialFilters {
  fiscalYear?: number;
  quarter?: string;
  fundType?: string;
  expenseClass?: string;
}

/**
 * Aggregate rows come back with their SUM and COUNT columns as strings, the way the driver
 * returns numeric and bigint. The callers parse them, and some pass them through untouched, so
 * the string form is part of the response contract and is deliberately not converted here.
 */
export interface PillarFinancialSummary {
  pillar_type: string;
  record_count: string;
  total_appropriation: string;
  total_obligations: string;
  total_disbursement: string;
  avg_utilization_rate: string;
  total_balance: string;
}

export interface CampusBreakdownRow {
  pillar_type: string;
  campus: string;
  total_appropriation: string;
  total_obligations: string;
  total_disbursement: string;
  utilization_rate: string;
}

export interface PillarExpenseRow {
  pillar_type: string;
  expense_class: string | null;
  total_appropriation: string;
  total_obligations: string;
  total_disbursement: string;
}

export interface QuarterlyTrendRow {
  quarter: string | null;
  total_appropriation: string;
  total_obligations: string;
  total_disbursement: string;
  utilization_rate: string;
}

export interface YearlyComparisonRow {
  fiscal_year: number;
  pillar_type: string;
  utilization_rate: string;
  total_appropriation: string;
  total_obligations: string;
}

export interface ExpenseBreakdownRow {
  expense_class: string;
  record_count: string;
  total_appropriation: string;
  total_obligations: string;
  total_disbursement: string;
}

// Shared aggregate expressions. SUM over a numeric column is NULL when no row matched, which
// is why every one is wrapped in COALESCE — the callers expect 0, not null.
// Columns of the joined operation, named the way the database names them: select() emits the
// string it is given, unlike groupBy()/orderBy() which translate a property path.
const PILLAR = `operation.operation_type`;
const FISCAL_YEAR = `operation.fiscal_year`;

const SUM_ALLOTMENT = `COALESCE(SUM(of0.allotment), 0)`;
const SUM_OBLIGATION = `COALESCE(SUM(of0.obligation), 0)`;
const SUM_DISBURSEMENT = `COALESCE(SUM(of0.disbursement), 0)`;
// Guarded against a zero denominator: a pillar with no appropriation reports 0%, not an error.
const UTILIZATION_RATE = `CASE WHEN SUM(of0.allotment) > 0
    THEN ROUND((SUM(of0.obligation)::numeric / SUM(of0.allotment)) * 100, 2)
    ELSE 0 END`;

export class OperationFinancialRepository extends EntityRepository<OperationFinancial> {
  // ─── Reads ─────────────────────────────────────────────────────────────────

  /** Every live financial record on one operation, newest fiscal year first. */
  async findForOperation(operationId: string): Promise<FinancialRow[]> {
    const records = await this.find(
      { operationId, deletedAt: null },
      {
        filters: false,
        orderBy: { fiscalYear: QueryOrder.DESC, quarter: QueryOrder.ASC },
      },
    );
    return records.map((r) => this.row(r));
  }

  /**
   * An operation's financial records, narrowed by any combination of the BAR1 tab filters.
   * A filter that is not supplied is simply not applied, as the appended WHERE clauses were.
   */
  async findFiltered(
    operationId: string,
    filters: FinancialFilters,
  ): Promise<FinancialRow[]> {
    const where: FilterQuery<OperationFinancial> = {
      operationId,
      deletedAt: null,
    };
    if (filters.fiscalYear)
      Object.assign(where, { fiscalYear: filters.fiscalYear });
    if (filters.quarter) Object.assign(where, { quarter: filters.quarter });
    if (filters.fundType) Object.assign(where, { fundType: filters.fundType });
    if (filters.expenseClass)
      Object.assign(where, { expenseClass: filters.expenseClass });

    const records = await this.find(where, {
      filters: false,
      orderBy: {
        fiscalYear: QueryOrder.DESC,
        quarter: QueryOrder.ASC,
        operationsPrograms: QueryOrder.ASC,
        id: QueryOrder.ASC,
      },
    });
    return records.map((r) => this.row(r));
  }

  /** One financial record's own columns, soft-deleted rows included. */
  async findPlain(financialId: string): Promise<FinancialRow | null> {
    const record = await this.findOne({ id: financialId }, { filters: false });
    return record ? this.row(record) : null;
  }

  /**
   * The fiscal year and quarter of one record of one operation, which the governance checks
   * need before they can decide whether the write is allowed. Null when the record does not
   * belong to that operation or has been deleted.
   */
  async findKey(
    financialId: string,
    operationId: string,
  ): Promise<FinancialKey | null> {
    const record = await this.findOne(
      { id: financialId, operationId, deletedAt: null },
      { fields: ['id', 'fiscalYear', 'quarter'], filters: false },
    );
    if (!record) return null;
    return {
      id: record.id,
      fiscal_year: record.fiscalYear,
      quarter: record.quarter ?? null,
    };
  }

  // ─── Writes ────────────────────────────────────────────────────────────────

  /** Insert a financial record and return it in the column shape the INSERT returned. */
  async createFinancial(
    operationId: string,
    dto: Record<string, any>,
    userId: string,
  ): Promise<FinancialRow> {
    const record = this.create(
      { operationId, createdBy: userId },
      { partial: true },
    );
    assignColumns(this.getEntityManager(), ENTITY, record, {
      ...dto,
      // These three were written as `dto.x || null` by the INSERT, so an empty string has
      // always been stored as NULL rather than ''.
      fund_type: dto.fund_type || null,
      project_code: dto.project_code || null,
      expense_class: dto.expense_class || null,
    });
    await this.getEntityManager().persist(record).flush();
    return this.row(record);
  }

  /**
   * Write the supplied columns onto a financial record and return the result. A key that is
   * not a column of this entity is ignored rather than interpolated into a SET clause.
   */
  async applyUpdate(
    financialId: string,
    dto: Record<string, any>,
    userId: string,
  ): Promise<FinancialRow | null> {
    const record = await this.findOne({ id: financialId }, { filters: false });
    if (!record) return null;

    assignColumns(this.getEntityManager(), ENTITY, record, dto);
    record.updatedBy = userId;
    await this.getEntityManager().flush();
    return this.row(record);
  }

  /** Soft-delete one record of one operation. Returns the rows affected (0 or 1). */
  softDelete(
    financialId: string,
    operationId: string,
    userId: string,
  ): Promise<number> {
    return this.nativeUpdate(
      { id: financialId, operationId, deletedAt: null },
      { deletedAt: new Date(), deletedBy: userId },
    );
  }

  // ─── Analytics ─────────────────────────────────────────────────────────────
  //
  // These are GROUP BY aggregations over the join to university_operations, built with the
  // query builder rather than assembled as SQL strings. Every value a caller supplies is a
  // bound parameter; the only inline SQL is the fixed SUM/ROUND expressions above.

  /** Per-pillar totals for one fiscal year. */
  getPillarSummary(fiscalYear: number): Promise<PillarFinancialSummary[]> {
    return this.aggregate(fiscalYear, {
      pillar_type: raw(PILLAR),
      record_count: raw(`COUNT(of0.id)`),
      total_appropriation: raw(SUM_ALLOTMENT),
      total_obligations: raw(SUM_OBLIGATION),
      total_disbursement: raw(SUM_DISBURSEMENT),
      avg_utilization_rate: raw(UTILIZATION_RATE),
      total_balance: raw(
        `COALESCE(SUM(of0.allotment) - SUM(of0.obligation), 0)`,
      ),
    })
      .groupBy(['operation.operationType'])
      .orderBy({ operation: { operationType: 'asc' } })
      .execute('all', false);
  }

  /**
   * Per-pillar, per-campus totals for one fiscal year. `campus` is the record's department —
   * records with none are grouped under 'Unspecified' rather than dropped.
   */
  getCampusBreakdown(fiscalYear: number): Promise<CampusBreakdownRow[]> {
    return this.aggregate(fiscalYear, {
      pillar_type: raw(PILLAR),
      campus: raw(`COALESCE(of0.department, 'Unspecified')`),
      total_appropriation: raw(SUM_ALLOTMENT),
      total_obligations: raw(SUM_OBLIGATION),
      total_disbursement: raw(SUM_DISBURSEMENT),
      utilization_rate: raw(UTILIZATION_RATE),
    })
      .groupBy(['operation.operationType', 'of0.department'])
      .orderBy([{ operation: { operationType: 'asc' } }, { department: 'asc' }])
      .execute('all', false);
  }

  /** Per-pillar PS/MOOE/CO totals for one fiscal year. */
  getPillarExpenseBreakdown(fiscalYear: number): Promise<PillarExpenseRow[]> {
    return this.aggregate(fiscalYear, {
      pillar_type: raw(PILLAR),
      expense_class: raw(`of0.expense_class`),
      total_appropriation: raw(SUM_ALLOTMENT),
      total_obligations: raw(SUM_OBLIGATION),
      total_disbursement: raw(SUM_DISBURSEMENT),
    })
      .groupBy(['operation.operationType', 'of0.expenseClass'])
      .orderBy([
        { operation: { operationType: 'asc' } },
        { expenseClass: 'asc' },
      ])
      .execute('all', false);
  }

  /** Per-quarter totals for one fiscal year, optionally narrowed to one pillar. */
  getQuarterlyTrend(
    fiscalYear: number,
    pillarType?: string,
  ): Promise<QuarterlyTrendRow[]> {
    const qb = this.aggregate(fiscalYear, {
      quarter: raw(`of0.quarter`),
      total_appropriation: raw(SUM_ALLOTMENT),
      total_obligations: raw(SUM_OBLIGATION),
      total_disbursement: raw(SUM_DISBURSEMENT),
      utilization_rate: raw(UTILIZATION_RATE),
    });
    if (pillarType && pillarType !== 'ALL') {
      qb.andWhere({ operation: { operationType: pillarType } });
    }
    return qb
      .groupBy(['of0.quarter'])
      .orderBy({ quarter: 'asc' })
      .execute('all', false);
  }

  /** Per-pillar utilisation across several fiscal years. */
  getYearlyComparison(years: number[]): Promise<YearlyComparisonRow[]> {
    if (years.length === 0) return Promise.resolve([]);
    return this.aggregate(
      { $in: years },
      {
        fiscal_year: raw(FISCAL_YEAR),
        pillar_type: raw(PILLAR),
        utilization_rate: raw(UTILIZATION_RATE),
        total_appropriation: raw(SUM_ALLOTMENT),
        total_obligations: raw(SUM_OBLIGATION),
      },
    )
      .groupBy(['operation.fiscalYear', 'operation.operationType'])
      .orderBy([
        { operation: { fiscalYear: 'asc' } },
        { operation: { operationType: 'asc' } },
      ])
      .execute('all', false);
  }

  /** PS/MOOE/CO totals across the whole fiscal year, ungrouped by pillar. */
  getExpenseBreakdown(fiscalYear: number): Promise<ExpenseBreakdownRow[]> {
    return this.aggregate(fiscalYear, {
      expense_class: raw(`COALESCE(of0.expense_class, 'Unclassified')`),
      record_count: raw(`COUNT(of0.id)`),
      total_appropriation: raw(SUM_ALLOTMENT),
      total_obligations: raw(SUM_OBLIGATION),
      total_disbursement: raw(SUM_DISBURSEMENT),
    })
      .groupBy(['of0.expenseClass'])
      .orderBy({ expenseClass: 'asc' })
      .execute('all', false);
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  /**
   * The shape every analytic above shares: financial records joined to their operation,
   * scoped to a fiscal year (or a set of them), with both soft-delete conditions applied.
   *
   * The fiscal year is the operation's, not the record's — the raw statements all filtered on
   * uo.fiscal_year, and the two can differ on a record entered against another year.
   */
  private aggregate(
    fiscalYear: number | { $in: number[] },
    fields: Record<string, any>,
  ) {
    return this.createQueryBuilder('of0')
      .select(Object.entries(fields).map(([alias, expr]) => expr.as(alias)))
      .join('of0.operation', 'operation')
      .where({
        deletedAt: null,
        operation: { fiscalYear, deletedAt: null },
      });
  }

  private row(record: OperationFinancial): FinancialRow {
    return toRow(this.getEntityManager(), ENTITY, record);
  }
}
