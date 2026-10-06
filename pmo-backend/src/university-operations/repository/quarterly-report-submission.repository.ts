import { EntityRepository } from '@mikro-orm/core';
import type { FilterQuery } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { QuarterlyReportSubmission } from '../../database/entities/quarterly-report-submission.entity';
import type { User } from '../../database/entities/user.entity';

/**
 * One event of the append-only submission log, with the report's title and current status and
 * the three display names the audit view shows.
 */
export interface SubmissionHistoryRow {
  id: string;
  quarterly_report_id: string;
  fiscal_year: number;
  quarter: string;
  version: number;
  event_type: string;
  submitted_by: string | null;
  submitted_at: Date | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  actioned_by: string;
  actioned_at: Date | null;
  reason: string | null;
  title: string | null;
  current_status: string | null;
  submitter_name: string | null;
  reviewed_by_name: string | null;
  actioned_by_name: string | null;
}

export type SubmissionEventType =
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVERTED'
  | 'UNLOCKED';

export interface RecordEventInput {
  quarterlyReportId: string;
  fiscalYear: number;
  quarter: string;
  version: number;
  eventType: SubmissionEventType;
  submittedBy?: string;
  submittedAt?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  actionedBy: string;
  reason?: string;
}

export class QuarterlyReportSubmissionRepository extends EntityRepository<QuarterlyReportSubmission> {
  /**
   * The whole event log, newest action first, optionally narrowed to a fiscal year and quarter.
   *
   * Events whose report has been soft-deleted are excluded, which is what the inner JOIN to
   * quarterly_reports with `qr.deleted_at IS NULL` did.
   */
  findHistory(
    fiscalYear?: number,
    quarter?: string,
  ): Promise<SubmissionHistoryRow[]> {
    const where: FilterQuery<QuarterlyReportSubmission> = {
      report: { deletedAt: null },
    };
    if (fiscalYear) Object.assign(where, { fiscalYear });
    if (quarter) Object.assign(where, { quarter });
    return this.loadHistory(where);
  }

  /** The event log for one report, newest action first. */
  findHistoryForReport(
    quarterlyReportId: string,
  ): Promise<SubmissionHistoryRow[]> {
    return this.loadHistory({
      quarterlyReportId,
      report: { deletedAt: null },
    });
  }

  /**
   * Append one event. The log is write-once: nothing here updates an existing row, so a
   * caller cannot rewrite history by replaying an event.
   */
  async recordEvent(
    input: RecordEventInput,
  ): Promise<QuarterlyReportSubmission> {
    const event = this.create(
      {
        quarterlyReportId: input.quarterlyReportId,
        fiscalYear: input.fiscalYear,
        quarter: input.quarter,
        version: input.version,
        eventType: input.eventType,
        submittedBy: input.submittedBy,
        submittedAt: input.submittedAt,
        reviewedBy: input.reviewedBy,
        reviewedAt: input.reviewedAt,
        reviewNotes: input.reviewNotes,
        actionedBy: input.actionedBy,
        reason: input.reason,
      },
      // partial: true — id, actioned_at and created_at are filled by the database or the
      // entity's own defaults, and create() would otherwise demand them.
      { partial: true },
    );
    await this.getEntityManager().persist(event).flush();
    return event;
  }

  private async loadHistory(
    where: FilterQuery<QuarterlyReportSubmission>,
  ): Promise<SubmissionHistoryRow[]> {
    const events = await this.find(where, {
      populate: ['report', 'submitter', 'reviewer', 'actor'],
      // filters: false — QuarterlyReport and User both carry a default 'notDeleted' filter,
      // which would make a populated relation resolve to null once the row is soft-deleted.
      // The report's own soft-delete condition is stated in `where` instead, so it still
      // applies; the user relations resolve a name whether or not the account was retired.
      filters: false,
      orderBy: { actionedAt: 'desc', id: 'asc' },
    });

    return events.map((e) => ({
      id: e.id,
      quarterly_report_id: e.quarterlyReportId,
      fiscal_year: e.fiscalYear,
      quarter: e.quarter,
      version: e.version,
      event_type: e.eventType,
      submitted_by: e.submittedBy ?? null,
      submitted_at: e.submittedAt ?? null,
      reviewed_by: e.reviewedBy ?? null,
      reviewed_at: e.reviewedAt ?? null,
      review_notes: e.reviewNotes ?? null,
      actioned_by: e.actionedBy,
      actioned_at: e.actionedAt ?? null,
      reason: e.reason ?? null,
      title: e.report.title ?? null,
      current_status: e.report.publicationStatus ?? null,
      submitter_name: fullName(e.submitter),
      reviewed_by_name: fullName(e.reviewer),
      actioned_by_name: fullName(e.actor),
    }));
  }
}

function fullName(user?: User | null): string | null {
  return user ? `${user.firstName} ${user.lastName}` : null;
}
