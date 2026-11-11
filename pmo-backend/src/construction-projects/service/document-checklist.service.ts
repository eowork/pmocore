import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  QueryOrder,
  UniqueConstraintViolationException,
  type EntityManager,
} from '@mikro-orm/core';
import {
  ConstructionDocumentChecklist,
  ConstructionDocumentSubmission,
  ConstructionDocumentType,
  ConstructionProject,
  Document,
} from '../../database/entities';
import { ConstructionDocumentChecklistRepository } from '../repository/construction-document-checklist.repository';
import { ConstructionDocumentSubmissionRepository } from '../repository/construction-document-submission.repository';
import { ConstructionDocumentTypeRepository } from '../repository/construction-document-type.repository';
import { ConstructionProjectRepository } from '../repository/construction-project.repository';
import { DocumentRepository } from '../../documents/repository/document.repository';
import { ConstructionAccessService } from './construction-access.service';
import { ActivityAction } from '../../activity-logs/activity-log.entity';
import { UploadsService } from '../../uploads';
import { JwtPayload } from '../../common/interfaces';
import {
  ChangeChecklistDocumentTypeDto,
  UpdateDocumentChecklistDto,
} from '../dto';

/** A checklist row as the API returns it: the stored row plus its resolved document type. */
export type ChecklistItemWithType = ConstructionDocumentChecklist & {
  documentType?: ConstructionDocumentType;
};

/**
 * Whether a checklist row carries anything a move would have to take with it.
 *
 * Remarks are excluded on purpose — they describe the requirement, not the submission, so a
 * row holding only remarks still counts as empty and can receive a move.
 */
function hasSubmission(item: ConstructionDocumentChecklist): boolean {
  return (
    !!item.linkedDocumentId ||
    (item.currentVersion ?? 0) > 0 ||
    item.submissionStatus !== 'NOT_SUBMITTED'
  );
}

/**
 * Per-project document compliance: the checklist itself, its remarks, the custom document
 * sections stored on the project row, and the submission ledger. Split out of
 * ConstructionProjectsService; the URLs and behaviour are unchanged.
 */
@Injectable()
export class DocumentChecklistService {
  private readonly logger = new Logger(DocumentChecklistService.name);

  constructor(
    @InjectRepository(ConstructionDocumentChecklist)
    private readonly docChecklistRepo: ConstructionDocumentChecklistRepository,
    @InjectRepository(ConstructionDocumentType)
    private readonly docTypeRepo: ConstructionDocumentTypeRepository,
    @InjectRepository(ConstructionDocumentSubmission)
    private readonly docSubmissionRepo: ConstructionDocumentSubmissionRepository,
    @InjectRepository(ConstructionProject)
    private readonly cpRepo: ConstructionProjectRepository,
    @InjectRepository(Document)
    private readonly documentRepo: DocumentRepository,
    private readonly access: ConstructionAccessService,
    private readonly uploadsService: UploadsService,
  ) {}

  /**
   * KB-E: Returns the per-project document checklist. On the first call for a
   * project, lazily seeds checklist rows from the active type reference
   * (one row per active document type). Idempotent — re-call is safe.
   */
  async findDocumentChecklist(
    projectId: string,
  ): Promise<ChecklistItemWithType[]> {
    await this.access.assertProjectExists(projectId);

    const activeTypes = await this.docTypeRepo.find(
      { isActive: true },
      { orderBy: [{ groupCode: QueryOrder.ASC, sortOrder: QueryOrder.ASC }] },
    );

    // Lazy initialization: insert missing checklist items
    const em = this.docChecklistRepo.getEntityManager();
    const existing = await this.docChecklistRepo.find({ projectId });
    const existingTypeIds = new Set(existing.map((c) => c.documentTypeId));
    const missing = activeTypes.filter((t) => !existingTypeIds.has(t.id));
    if (missing.length > 0) {
      for (const t of missing) {
        const item = this.docChecklistRepo.create({
          projectId,
          documentTypeId: t.id,
          submissionStatus: 'NOT_SUBMITTED',
          currentVersion: 0,
        });
        em.persist(item);
      }
      await em.flush();
    }

    // Re-fetch with fresh state and join document type info
    const rows = await this.docChecklistRepo.find({ projectId });
    const typeById = new Map(activeTypes.map((t) => [t.id, t]));
    return rows.map((r) => ({
      ...r,
      documentType: typeById.get(r.documentTypeId),
    }));
  }

  /**
   * Move a checklist item's submission onto a different document type.
   *
   * findDocumentChecklist seeds one row per active document type, so in every normal case the
   * target type already has a row. Changing the type therefore cannot mean relabelling this
   * row: it would collide with the target's row on
   * construction_document_checklist_project_id_document_type_id_key, and the vacated type
   * would be re-seeded blank on the next read anyway. It means moving the evidence — the
   * linked file, the version counter and the submission ledger are transferred onto the
   * target type's row, the files are re-filed under the target's type code so the attachment
   * hub shows them in the right repository, and this row returns to NOT_SUBMITTED.
   *
   * The review verdict is deliberately left behind. An approval records that a named reviewer
   * accepted a specific file as a specific requirement; carrying it over would assert a review
   * that never took place. A moved submission arrives as SUBMITTED and is reviewed again.
   */
  async changeChecklistDocumentType(
    projectId: string,
    itemId: string,
    dto: ChangeChecklistDocumentTypeDto,
    user: JwtPayload,
  ): Promise<ChecklistItemWithType> {
    await this.access.assertProjectExists(projectId);
    await this.access.assertProjectPermission(
      projectId,
      user.sub,
      user,
      'canEdit',
    );

    const targetType = await this.docTypeRepo.findOne({
      id: dto.documentTypeId,
      isActive: true,
    });
    if (!targetType)
      throw new NotFoundException(
        `Target document type ${dto.documentTypeId} not found or inactive`,
      );

    let previousDocumentTypeId = '';
    let movedDocumentCount = 0;

    try {
      // One transaction: the ledger move, both rows and the re-filed documents either all
      // land or none do. Everything is (re)loaded through the transactional EntityManager,
      // because entities loaded outside it belong to a different identity map and their
      // changes would not be flushed here.
      const moved = await this.docChecklistRepo
        .getEntityManager()
        .transactional(async (em) => {
          const source = await em.findOne(ConstructionDocumentChecklist, {
            id: itemId,
            projectId,
          });
          if (!source)
            throw new NotFoundException(`Checklist item ${itemId} not found`);

          previousDocumentTypeId = source.documentTypeId;

          // Already filed under this type: nothing to move, and nothing to record.
          if (source.documentTypeId === targetType.id) return source;

          if (!hasSubmission(source)) {
            throw new UnprocessableEntityException(
              `This checklist item has no submission to move. Upload the document under "${targetType.typeLabel}" instead.`,
            );
          }

          let target = await em.findOne(ConstructionDocumentChecklist, {
            projectId,
            documentTypeId: targetType.id,
          });

          if (target && hasSubmission(target)) {
            throw new ConflictException(
              `"${targetType.typeLabel}" already has a submission. Remove it before moving another document onto it.`,
            );
          }

          if (!target) {
            // Reached only for a type added or activated since this project's checklist was
            // last read; findDocumentChecklist would have seeded the row otherwise. Flushed
            // immediately because the id is generated by the database and the ledger update
            // below needs it.
            target = em.create(ConstructionDocumentChecklist, {
              projectId,
              documentTypeId: targetType.id,
              submissionStatus: 'NOT_SUBMITTED',
              currentVersion: 0,
            });
            await em.persistAndFlush(target);
          }

          // The ledger is keyed by checklist item, so the history follows the evidence.
          await em.nativeUpdate(
            ConstructionDocumentSubmission,
            { projectId, checklistItemId: source.id },
            { checklistItemId: target.id },
          );

          target.linkedDocumentId = source.linkedDocumentId;
          target.currentVersion = source.currentVersion;
          target.submittedBy = source.submittedBy;
          target.submittedAt = source.submittedAt;
          target.expiryDate = source.expiryDate;
          target.submissionStatus = 'SUBMITTED';
          target.reviewedBy = undefined;
          target.reviewedAt = undefined;
          target.reviewNotes = undefined;

          movedDocumentCount = await this.refileDocuments(
            em,
            projectId,
            target.id,
            source.linkedDocumentId,
            targetType.typeCode,
            user.sub,
          );

          // Remarks stay behind: they are notes about the requirement, not about the file.
          source.linkedDocumentId = undefined;
          source.currentVersion = 0;
          source.submittedBy = undefined;
          source.submittedAt = undefined;
          source.expiryDate = undefined;
          source.submissionStatus = 'NOT_SUBMITTED';
          source.reviewedBy = undefined;
          source.reviewedAt = undefined;
          source.reviewNotes = undefined;

          await em.flush();
          return target;
        });

      if (previousDocumentTypeId !== targetType.id) {
        this.access.fireLog(user, ActivityAction.UPDATE, projectId, {
          section: 'CHECKLIST',
          action: 'change_document_type',
          checklistItemId: itemId,
          targetChecklistItemId: moved.id,
          previousDocumentTypeId,
          newDocumentTypeId: targetType.id,
          newDocumentTypeCode: targetType.typeCode,
          refiledDocumentCount: movedDocumentCount,
        });
      }

      return { ...moved, documentType: targetType };
    } catch (err) {
      // The duplicate check above and the unique index cover the same rule; a concurrent
      // write can still slip between them, and that is the same conflict, not a 500.
      if (err instanceof UniqueConstraintViolationException) {
        throw new ConflictException(
          `"${targetType.typeLabel}" already has a checklist entry. Reload the checklist and try again.`,
        );
      }
      throw err;
    }
  }

  /**
   * Re-file the documents behind a moved submission under the target type's code.
   *
   * documents.document_type holds a type CODE, which is what every type-based view matches
   * on — leaving it alone would keep the file showing under the repository card of the type
   * it was moved away from. Returns how many documents were re-typed.
   */
  private async refileDocuments(
    em: EntityManager,
    projectId: string,
    checklistItemId: string,
    linkedDocumentId: string | undefined,
    typeCode: string,
    userId: string,
  ): Promise<number> {
    const submissions = await em.find(ConstructionDocumentSubmission, {
      projectId,
      checklistItemId,
    });

    const documentIds = new Set(submissions.map((s) => s.documentId));
    if (linkedDocumentId) documentIds.add(linkedDocumentId);
    if (documentIds.size === 0) return 0;

    // filters: false — a soft-deleted document still belongs to the history being moved, and
    // leaving it typed to the old requirement would make that history read inconsistently.
    const documents = await em.find(
      Document,
      { id: { $in: [...documentIds] } },
      { filters: false },
    );
    for (const document of documents) {
      document.documentType = typeCode;
      document.updatedBy = userId;
    }
    return documents.length;
  }

  async updateDocumentChecklistItem(
    projectId: string,
    itemId: string,
    dto: UpdateDocumentChecklistDto,
    userId: string,
    user?: JwtPayload,
  ): Promise<ConstructionDocumentChecklist> {
    await this.access.assertProjectExists(projectId);
    // Record-scope guard: the checklist records compliance status for this project, so
    // changing it is a project write.
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        userId,
        user,
        'canEdit',
      );
    const entity = await this.docChecklistRepo.findOne({
      id: itemId,
      projectId,
    });
    if (!entity)
      throw new NotFoundException(`Checklist item ${itemId} not found`);

    // KB-D: Snapshot for field-delta audit
    const before = {
      submissionStatus: entity.submissionStatus,
      reviewNotes: entity.reviewNotes,
      expiryDate: entity.expiryDate,
      linkedDocumentId: entity.linkedDocumentId,
      currentVersion: entity.currentVersion,
      remarks: entity.remarks,
    };

    if (dto.submission_status !== undefined) {
      entity.submissionStatus = dto.submission_status;
      // Auto-stamp submitted/reviewed identity based on status transition
      if (dto.submission_status === 'SUBMITTED' && !entity.submittedAt) {
        entity.submittedBy = userId;
        entity.submittedAt = new Date();
      }
      if (
        dto.submission_status === 'APPROVED' ||
        dto.submission_status === 'REJECTED'
      ) {
        entity.reviewedBy = userId;
        entity.reviewedAt = new Date();
      }
    }
    if (dto.review_notes !== undefined) entity.reviewNotes = dto.review_notes;
    if (dto.expiry_date !== undefined)
      entity.expiryDate = dto.expiry_date
        ? new Date(dto.expiry_date)
        : undefined;
    if (dto.linked_document_id !== undefined)
      entity.linkedDocumentId = dto.linked_document_id;
    if (dto.current_version !== undefined)
      entity.currentVersion = dto.current_version;
    if (dto.remarks !== undefined) entity.remarks = dto.remarks;
    await this.docChecklistRepo.getEntityManager().flush();

    const after = {
      submissionStatus: entity.submissionStatus,
      reviewNotes: entity.reviewNotes,
      expiryDate: entity.expiryDate,
      linkedDocumentId: entity.linkedDocumentId,
      currentVersion: entity.currentVersion,
      remarks: entity.remarks,
    };
    const changedFields = Object.keys(after).filter(
      (k) =>
        JSON.stringify((before as any)[k]) !==
        JSON.stringify((after as any)[k]),
    );
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    for (const k of changedFields) {
      previousValues[k] = (before as any)[k];
      newValues[k] = (after as any)[k];
    }

    this.logger.log(
      `DOC_CHECKLIST_UPDATED: id=${itemId}, project=${projectId}, by=${userId}, status=${entity.submissionStatus}`,
    );
    this.access.fireLog(user, ActivityAction.UPDATE, projectId, {
      section: 'CHECKLIST',
      entityType: 'CONSTRUCTION_DOCUMENT_CHECKLIST',
      checklistItemId: itemId,
      changedFields,
      previousValues,
      newValues,
    });
    return entity;
  }

  // KV-D2: per-group document checklist remarks
  async updateDocumentRemarks(
    projectId: string,
    groupCode: string,
    remarks: unknown,
    userId: string,
    user?: JwtPayload,
  ): Promise<void> {
    const entity = await this.cpRepo.findOne({ id: projectId });
    if (!entity) throw new NotFoundException(`Project ${projectId} not found`);
    // Record-scope guard — checklist remarks are stored on the project row itself.
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        userId,
        user,
        'canEdit',
      );
    const current: Record<
      string,
      string | Array<{ text: string; author: string; timestamp: string }>
    > = {};
    if (
      entity.documentChecklistRemarks &&
      typeof entity.documentChecklistRemarks === 'object'
    ) {
      Object.entries(entity.documentChecklistRemarks).forEach(
        ([key, value]) => {
          if (typeof value === 'string') {
            current[key] = value;
            return;
          }
          if (Array.isArray(value)) {
            const entries = value
              .map((entry: any) => ({
                text: String(entry?.text ?? '').trim(),
                author: String(entry?.author ?? ''),
                timestamp: String(entry?.timestamp ?? ''),
              }))
              .filter((entry) => entry.text.length > 0);
            current[key] = entries;
          }
        },
      );
    }
    const normalizedRemarks = Array.isArray(remarks)
      ? remarks
          .map((entry: any) => ({
            text: String(entry?.text ?? '').trim(),
            author: String(entry?.author ?? user?.email ?? userId),
            timestamp: String(entry?.timestamp ?? new Date().toISOString()),
          }))
          .filter((entry) => entry.text.length > 0)
      : String(remarks ?? '').trim();
    entity.documentChecklistRemarks = {
      ...current,
      [groupCode]: normalizedRemarks,
    };
    await this.cpRepo.getEntityManager().flush();
    this.access.fireLog(user, ActivityAction.UPDATE, projectId, {
      section: 'CHECKLIST_REMARKS',
      action: 'update_document_remarks',
      groupCode,
    });
  }

  // AAA-F-3: per-project custom Key Document repository sections
  async updateCustomKeySections(
    projectId: string,
    sections: Array<{ id: string; label: string; typeCode: string }>,
    user?: JwtPayload,
  ): Promise<Array<{ id: string; label: string; typeCode: string }>> {
    const entity = await this.cpRepo.findOne({ id: projectId });
    if (!entity) throw new NotFoundException(`Project ${projectId} not found`);
    // Record-scope guard — custom Key Document sections are per-project configuration.
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canEdit',
      );
    entity.customKeySections = Array.isArray(sections) ? sections : [];
    await this.cpRepo.getEntityManager().flush();
    this.access.fireLog(user, ActivityAction.UPDATE, projectId, {
      section: 'KEY_DOCUMENTS',
      action: 'update_custom_key_sections',
      count: entity.customKeySections.length,
    });
    return entity.customKeySections;
  }

  // SSS-B: per-project custom Supporting Document repository folders
  async updateCustomSupportingSections(
    projectId: string,
    sections: Array<{ id: string; label: string; typeCode: string }>,
    user?: JwtPayload,
  ): Promise<Array<{ id: string; label: string; typeCode: string }>> {
    const entity = await this.cpRepo.findOne({ id: projectId });
    if (!entity) throw new NotFoundException(`Project ${projectId} not found`);
    // Record-scope guard — custom Supporting Document folders are per-project configuration.
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        user.sub,
        user,
        'canEdit',
      );
    entity.customSupportingSections = Array.isArray(sections) ? sections : [];
    await this.cpRepo.getEntityManager().flush();
    this.access.fireLog(user, ActivityAction.UPDATE, projectId, {
      section: 'SUPPORTING_DOCUMENTS',
      action: 'update_custom_supporting_sections',
      count: entity.customSupportingSections.length,
    });
    return entity.customSupportingSections;
  }

  // ZT-5: List all submission versions for a checklist item (immutable ledger)
  async getDocumentSubmissions(
    projectId: string,
    checklistItemId: string,
  ): Promise<unknown[]> {
    await this.access.assertProjectExists(projectId);
    return this.docSubmissionRepo.findForChecklistItem(
      projectId,
      checklistItemId,
    );
  }

  // ZT-4: Submit a new version for a checklist item (file upload + ledger row + checklist update)
  async submitDocumentVersion(
    projectId: string,
    checklistItemId: string,
    file: Express.Multer.File,
    notes: string | undefined,
    user: JwtPayload,
  ): Promise<{
    submission: ConstructionDocumentSubmission;
    document: Document;
  }> {
    await this.access.assertProjectExists(projectId);
    // Record-scope guard — submitting a document version writes to the project's checklist.
    await this.access.assertProjectPermission(
      projectId,
      user.sub,
      user,
      'canUpload',
    );
    const checklistItem = await this.docChecklistRepo.findOne({
      id: checklistItemId,
      projectId,
    });
    if (!checklistItem)
      throw new NotFoundException(
        `Checklist item ${checklistItemId} not found`,
      );

    // documents.document_type holds a type CODE, not the type's id — it is what every
    // type-based view matches on. Storing the uuid here filed the submitted file under a
    // type no repository card recognises, so it surfaced under Miscellaneous instead of the
    // requirement it was submitted for.
    const documentType = await this.docTypeRepo.findOne({
      id: checklistItem.documentTypeId,
    });
    if (!documentType)
      throw new NotFoundException(
        `Document type ${checklistItem.documentTypeId} not found`,
      );

    const upload = await this.uploadsService.uploadFile(
      file,
      user.sub,
      'coi-submissions',
    );
    const doc = this.documentRepo.create({
      documentableType: 'CONSTRUCTION_PROJECT',
      documentableId: projectId,
      documentType: documentType.typeCode,
      fileName: upload.originalName,
      filePath: upload.filePath,
      fileSize: upload.fileSize,
      mimeType: upload.mimeType,
      lifecycleStatus: 'ACTIVE',
      uploadedBy: user.sub,
      createdBy: user.sub,
    });
    await this.documentRepo.getEntityManager().persist(doc).flush();

    const nextVersion =
      await this.docSubmissionRepo.nextVersion(checklistItemId);

    const submission = await this.docSubmissionRepo.recordSubmission({
      checklistItemId,
      projectId,
      documentId: doc.id,
      version: nextVersion,
      submittedBy: user.sub,
      submissionNotes: notes,
    });

    checklistItem.linkedDocumentId = doc.id;
    checklistItem.currentVersion = nextVersion;
    checklistItem.submissionStatus = 'SUBMITTED';
    checklistItem.submittedBy = user.sub;
    checklistItem.submittedAt = new Date();
    await this.docChecklistRepo.getEntityManager().flush();

    this.access.fireLog(user, ActivityAction.SUBMIT, projectId, {
      section: 'CHECKLIST',
      checklistItemId,
      documentId: doc.id,
      fileName: upload.originalName,
      version: nextVersion,
    });

    return { submission, document: doc };
  }
}
