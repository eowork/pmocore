import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { QueryOrder } from '@mikro-orm/core';
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
import { UpdateDocumentChecklistDto } from '../dto';

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
  async findDocumentChecklist(projectId: string): Promise<
    Array<
      ConstructionDocumentChecklist & {
        documentType?: ConstructionDocumentType;
      }
    >
  > {
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

    const upload = await this.uploadsService.uploadFile(
      file,
      user.sub,
      'coi-submissions',
    );
    const doc = this.documentRepo.create({
      documentableType: 'CONSTRUCTION_PROJECT',
      documentableId: projectId,
      documentType: checklistItem.documentTypeId,
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
