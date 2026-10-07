import { EntityRepository, QueryOrder } from '@mikro-orm/core';
// The entity binds this repository back through its @Entity() options, so importing it as a
// value here would close a runtime require cycle. As a type it is erased at compile time.
import type { ConstructionDocumentSubmission } from '../../database/entities/construction-document-submission.entity';

/** One version in a checklist item's submission history, with the file and submitter named. */
export interface SubmissionHistoryRow {
  id: string;
  checklist_item_id: string;
  project_id: string;
  document_id: string;
  version: number;
  submitted_by: string;
  submitted_at: Date;
  submission_notes: string | null;
  created_at: Date;
  original_name: string | null;
  file_path: string | null;
  file_size: number | string | null;
  submitter_name: string | null;
}

export class ConstructionDocumentSubmissionRepository extends EntityRepository<ConstructionDocumentSubmission> {
  /**
   * Every version submitted for one checklist item, newest first.
   *
   * The joins to documents and users are populated relations — see the entity — so the file's
   * stored name and the submitter's display name come back without a hand-written join.
   */
  async findForChecklistItem(
    projectId: string,
    checklistItemId: string,
  ): Promise<SubmissionHistoryRow[]> {
    const submissions = await this.find(
      { projectId, checklistItemId },
      {
        populate: ['document', 'submitter'],
        // filters: false — Document and User each carry a default 'notDeleted' filter, which
        // would blank the name once the row is soft-deleted. The history is a record of what
        // happened; a deleted file should still show the name it was submitted under.
        filters: false,
        orderBy: { version: QueryOrder.DESC },
      },
    );

    return submissions.map((s) => ({
      id: s.id,
      checklist_item_id: s.checklistItemId,
      project_id: s.projectId,
      document_id: s.documentId,
      version: s.version,
      submitted_by: s.submittedBy,
      submitted_at: s.submittedAt,
      submission_notes: s.submissionNotes ?? null,
      created_at: s.createdAt,
      original_name: s.document?.fileName ?? null,
      file_path: s.document?.filePath ?? null,
      file_size: s.document?.fileSize ?? null,
      submitter_name: s.submitter
        ? `${s.submitter.firstName} ${s.submitter.lastName}`
        : null,
    }));
  }

  /** How many versions reference one document. Zero means it has no submission history. */
  countForDocument(documentId: string): Promise<number> {
    return this.count({ documentId });
  }

  /**
   * The version number the next submission for a checklist item should carry.
   *
   * Numbering is per checklist item and starts at 1. Two submissions racing would compute the
   * same number, as the MAX(version) + 1 statement this replaces also would — the table has no
   * unique constraint on (checklist_item_id, version) to catch it either.
   */
  async nextVersion(checklistItemId: string): Promise<number> {
    const latest = await this.findOne(
      { checklistItemId },
      { fields: ['version'], orderBy: { version: QueryOrder.DESC } },
    );
    return (latest?.version ?? 0) + 1;
  }

  /** Append one submission to a checklist item's history. */
  async recordSubmission(input: {
    checklistItemId: string;
    projectId: string;
    documentId: string;
    version: number;
    submittedBy: string;
    submissionNotes?: string;
  }): Promise<ConstructionDocumentSubmission> {
    const submission = this.create(
      {
        checklistItemId: input.checklistItemId,
        projectId: input.projectId,
        documentId: input.documentId,
        version: input.version,
        submittedBy: input.submittedBy,
        submittedAt: new Date(),
        submissionNotes: input.submissionNotes,
      },
      // partial: true — id and created_at are filled by the database or the entity's own
      // defaults, and create() would otherwise demand them.
      { partial: true },
    );
    await this.getEntityManager().persist(submission).flush();
    return submission;
  }
}
