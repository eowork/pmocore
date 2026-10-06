import { EntityRepository, raw } from '@mikro-orm/postgresql';
import { QueryOrder } from '@mikro-orm/core';
import type { FilterQuery } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { QuarterlyReport } from '../../database/entities/quarterly-report.entity';
import type { User } from '../../database/entities/user.entity';
import { toRow } from './entity-row';

const ENTITY = 'QuarterlyReport';

/** A quarterly report's own columns under their snake_case names. */
export type QuarterlyReportRow = Record<string, any>;

/** The list shape: every column plus the submitter's display name. */
export interface QuarterlyReportDetailRow extends QuarterlyReportRow {
  submitter_name: string | null;
}

/** The admin review queue, with flags saying which data the quarter actually has. */
export interface PendingReviewReportRow {
  id: string;
  fiscal_year: number;
  quarter: string;
  title: string | null;
  publication_status: string | null;
  submitted_by: string | null;
  submitted_at: Date | null;
  created_at: Date;
  submitter_name: string | null;
  has_physical: boolean;
  has_financial: boolean;
}

export interface PendingUnlockReportRow {
  id: string;
  fiscal_year: number;
  quarter: string;
  title: string | null;
  publication_status: string | null;
  unlock_requested_by: string | null;
  unlock_requested_at: Date | null;
  unlock_request_reason: string | null;
  created_at: Date;
  requester_name: string | null;
}

export interface ReviewedReportRow {
  id: string;
  fiscal_year: number;
  quarter: string;
  title: string | null;
  publication_status: string | null;
  submitted_by: string | null;
  submitted_at: Date | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  unlocked_by: string | null;
  unlocked_at: Date | null;
  reviewed_by_name: string | null;
  submitter_name: string | null;
  unlocked_by_name: string | null;
}

/** What autoRevertQuarterlyReport reads before deciding whether to revert. */
export interface RevertCandidate {
  id: string;
  fiscal_year: number;
  quarter: string;
  publication_status: string | null;
  submission_count: number;
  submitted_by: string | null;
  submitted_at: Date | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
}

export class QuarterlyReportRepository extends EntityRepository<QuarterlyReport> {
  // ─── Reads ─────────────────────────────────────────────────────────────────

  /** Reports, optionally narrowed to a fiscal year and quarter, newest year first. */
  async findReports(
    fiscalYear?: number,
    quarter?: string,
  ): Promise<QuarterlyReportDetailRow[]> {
    const where: FilterQuery<QuarterlyReport> = { deletedAt: null };
    if (fiscalYear) Object.assign(where, { fiscalYear });
    if (quarter) Object.assign(where, { quarter });

    const reports = await this.find(where, {
      populate: ['submitter'] as any,
      // filters: false — User carries a default 'notDeleted' filter, which would make the
      // populated relation resolve to null once that account is soft-deleted. The previous
      // LEFT JOIN resolved the name regardless. The report's own soft-delete is in `where`.
      filters: false,
      orderBy: {
        fiscalYear: QueryOrder.DESC,
        quarter: QueryOrder.ASC,
        id: QueryOrder.ASC,
      },
    });
    return reports.map((r) => this.detailRow(r));
  }

  /** One report with its submitter's display name, or null. */
  async findDetail(id: string): Promise<QuarterlyReportDetailRow | null> {
    const report = await this.findOne(
      { id, deletedAt: null },
      { populate: ['submitter'] as any, filters: false },
    );
    return report ? this.detailRow(report) : null;
  }

  /** The live report for one fiscal year and quarter, or null. */
  async findForPeriod(
    fiscalYear: number,
    quarter: string,
  ): Promise<RevertCandidate | null> {
    const report = await this.findOne(
      { fiscalYear, quarter, deletedAt: null },
      { filters: false },
    );
    if (!report) return null;
    return {
      id: report.id,
      fiscal_year: report.fiscalYear,
      quarter: report.quarter,
      publication_status: report.publicationStatus ?? null,
      submission_count: report.submissionCount,
      submitted_by: report.submittedBy ?? null,
      submitted_at: report.submittedAt ?? null,
      reviewed_by: report.reviewedBy ?? null,
      reviewed_at: report.reviewedAt ?? null,
      review_notes: report.reviewNotes ?? null,
    };
  }

  /**
   * The admin review queue. has_physical and has_financial say whether the quarter's fiscal
   * year has any indicator or financial data at all, which the UI uses to label the submission.
   *
   * Both are EXISTS subqueries over other tables keyed on fiscal_year, not relations, so they
   * are resolved as two set lookups and matched in memory — one query each, not one per row.
   */
  async findPendingReview(): Promise<PendingReviewReportRow[]> {
    const reports = await this.find(
      { publicationStatus: 'PENDING_REVIEW', deletedAt: null },
      {
        populate: ['submitter'] as any,
        filters: false,
        orderBy: { submittedAt: QueryOrder.ASC, id: QueryOrder.ASC },
      },
    );
    if (reports.length === 0) return [];

    const years = [...new Set(reports.map((r) => r.fiscalYear))];
    const physicalYears = await this.yearsWithIndicatorData(years);
    const financialYears = await this.yearsWithFinancialData(years);

    return reports.map((r) => ({
      id: r.id,
      fiscal_year: r.fiscalYear,
      quarter: r.quarter,
      title: r.title ?? null,
      publication_status: r.publicationStatus ?? null,
      submitted_by: r.submittedBy ?? null,
      submitted_at: r.submittedAt ?? null,
      created_at: r.createdAt,
      submitter_name: fullName(r.submitter),
      has_physical: physicalYears.has(r.fiscalYear),
      has_financial: financialYears.has(r.fiscalYear),
    }));
  }

  /** Reports with an unlock request waiting, oldest request first. */
  async findPendingUnlock(): Promise<PendingUnlockReportRow[]> {
    const reports = await this.find(
      { unlockRequestedBy: { $ne: null }, deletedAt: null },
      {
        populate: ['unlockRequester'] as any,
        filters: false,
        orderBy: { unlockRequestedAt: QueryOrder.ASC, id: QueryOrder.ASC },
      },
    );
    return reports.map((r) => ({
      id: r.id,
      fiscal_year: r.fiscalYear,
      quarter: r.quarter,
      title: r.title ?? null,
      publication_status: r.publicationStatus ?? null,
      unlock_requested_by: r.unlockRequestedBy ?? null,
      unlock_requested_at: r.unlockRequestedAt ?? null,
      unlock_request_reason: r.unlockRequestReason ?? null,
      created_at: r.createdAt,
      requester_name: fullName(r.unlockRequester),
    }));
  }

  /**
   * The admin archive: reports that have been through review. Ordered by review date, newest
   * first, with reports never reviewed last — `NULLS LAST` was explicit in the statement this
   * replaces, and it is not Postgres's default for DESC.
   */
  async findReviewed(): Promise<ReviewedReportRow[]> {
    const reports = await this.find(
      {
        publicationStatus: { $in: ['PUBLISHED', 'REJECTED'] },
        deletedAt: null,
      },
      {
        populate: ['reviewer', 'submitter', 'unlocker'] as any,
        filters: false,
        orderBy: { reviewedAt: QueryOrder.DESC_NULLS_LAST, id: QueryOrder.ASC },
      },
    );
    return reports.map((r) => ({
      id: r.id,
      fiscal_year: r.fiscalYear,
      quarter: r.quarter,
      title: r.title ?? null,
      publication_status: r.publicationStatus ?? null,
      submitted_by: r.submittedBy ?? null,
      submitted_at: r.submittedAt ?? null,
      reviewed_by: r.reviewedBy ?? null,
      reviewed_at: r.reviewedAt ?? null,
      review_notes: r.reviewNotes ?? null,
      unlocked_by: r.unlockedBy ?? null,
      unlocked_at: r.unlockedAt ?? null,
      reviewed_by_name: fullName(r.reviewer),
      submitter_name: fullName(r.submitter),
      unlocked_by_name: fullName(r.unlocker),
    }));
  }

  // ─── Workflow transitions ──────────────────────────────────────────────────
  //
  // Each of these used to be a single UPDATE ... RETURNING *, so each returns the report's own
  // columns — no joined names. The entity is loaded, mutated and flushed rather than updated in
  // place, because the caller needs the resulting row back.

  markSubmitted(
    id: string,
    userId: string,
  ): Promise<QuarterlyReportRow | null> {
    return this.transition(id, (r) => {
      r.publicationStatus = 'PENDING_REVIEW';
      r.submittedBy = userId;
      r.submittedAt = new Date();
      r.reviewNotes = undefined;
      // COALESCE(submission_count, 0) + 1 — the column is NOT NULL with a default of 0, so the
      // entity's own value is always a number here.
      r.submissionCount = (r.submissionCount ?? 0) + 1;
    });
  }

  markApproved(
    id: string,
    adminId: string,
  ): Promise<QuarterlyReportRow | null> {
    return this.transition(id, (r) => {
      r.publicationStatus = 'PUBLISHED';
      r.reviewedBy = adminId;
      r.reviewedAt = new Date();
      r.reviewNotes = undefined;
    });
  }

  markRejected(
    id: string,
    adminId: string,
    notes: string,
  ): Promise<QuarterlyReportRow | null> {
    return this.transition(id, (r) => {
      r.publicationStatus = 'REJECTED';
      r.reviewedBy = adminId;
      r.reviewedAt = new Date();
      r.reviewNotes = notes;
    });
  }

  markWithdrawn(id: string): Promise<QuarterlyReportRow | null> {
    return this.transition(id, (r) => {
      r.publicationStatus = 'DRAFT';
      r.submittedBy = undefined;
      r.submittedAt = undefined;
    });
  }

  /**
   * Return a report to DRAFT because its underlying data changed. Clears the review metadata
   * but, unlike an unlock, records nothing about who did it — the trigger is an edit elsewhere.
   * Matched by id with no deleted_at condition, as the statement it replaces was.
   */
  async revertToDraft(id: string): Promise<number> {
    return this.nativeUpdate(
      { id },
      {
        publicationStatus: 'DRAFT',
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        submittedBy: null,
        submittedAt: null,
        updatedAt: new Date(),
      },
    );
  }

  /** Unlock a published report: back to DRAFT, review metadata and any request both cleared. */
  markUnlocked(
    id: string,
    adminId: string,
  ): Promise<QuarterlyReportRow | null> {
    return this.transition(id, (r) => {
      r.publicationStatus = 'DRAFT';
      r.reviewedBy = undefined;
      r.reviewedAt = undefined;
      r.reviewNotes = undefined;
      r.submittedBy = undefined;
      r.submittedAt = undefined;
      r.unlockedBy = adminId;
      r.unlockedAt = new Date();
      r.unlockRequestedBy = undefined;
      r.unlockRequestedAt = undefined;
      r.unlockRequestReason = undefined;
    });
  }

  requestUnlock(
    id: string,
    userId: string,
    reason: string,
  ): Promise<QuarterlyReportRow | null> {
    return this.transition(id, (r) => {
      r.unlockRequestedBy = userId;
      r.unlockRequestedAt = new Date();
      r.unlockRequestReason = reason;
    });
  }

  clearUnlockRequest(id: string): Promise<QuarterlyReportRow | null> {
    return this.transition(id, (r) => {
      r.unlockRequestedBy = undefined;
      r.unlockRequestedAt = undefined;
      r.unlockRequestReason = undefined;
    });
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private async transition(
    id: string,
    mutate: (report: QuarterlyReport) => void,
  ): Promise<QuarterlyReportRow | null> {
    const report = await this.findOne(
      { id, deletedAt: null },
      { filters: false },
    );
    if (!report) return null;
    mutate(report);
    await this.getEntityManager().flush();
    return toRow(this.getEntityManager(), ENTITY, report);
  }

  private detailRow(report: QuarterlyReport): QuarterlyReportDetailRow {
    return {
      ...toRow(this.getEntityManager(), ENTITY, report),
      submitter_name: fullName(report.submitter),
    };
  }

  /** Of the fiscal years asked about, the ones with at least one indicator value recorded. */
  private async yearsWithIndicatorData(years: number[]): Promise<Set<number>> {
    const quarterly = [1, 2, 3, 4].flatMap((q) => [
      { [`targetQ${q}`]: { $ne: null } },
      { [`accomplishmentQ${q}`]: { $ne: null } },
    ]);
    const rows = await this.getEntityManager()
      .createQueryBuilder('OperationIndicator', 'oi')
      .select(raw('DISTINCT operation.fiscal_year').as('fiscal_year'))
      .join('oi.operation', 'operation')
      .where({
        deletedAt: null,
        operation: { fiscalYear: { $in: years } },
        $or: quarterly,
      })
      .execute('all', false);
    return new Set(rows.map((r: any) => Number(r.fiscal_year)));
  }

  /**
   * Of the fiscal years asked about, the ones with any financial record.
   *
   * Keyed on operation_financials.fiscal_year, the record's own, not the owning operation's —
   * the EXISTS subquery this replaces compared `of2.fiscal_year = qr.fiscal_year`, and the two
   * columns can differ.
   */
  private async yearsWithFinancialData(years: number[]): Promise<Set<number>> {
    const rows = await this.getEntityManager()
      .createQueryBuilder('OperationFinancial', 'of0')
      .select(raw('DISTINCT of0.fiscal_year').as('fiscal_year'))
      .where({ deletedAt: null, fiscalYear: { $in: years } })
      .execute('all', false);
    return new Set(rows.map((r: any) => Number(r.fiscal_year)));
  }
}

function fullName(user?: User | null): string | null {
  return user ? `${user.firstName} ${user.lastName}` : null;
}
