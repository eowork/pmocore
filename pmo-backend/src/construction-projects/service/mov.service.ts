import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { FilterQuery } from '@mikro-orm/core';
import {
  ConstructionMilestone,
  ConstructionMovEntry,
  ConstructionTimelineEntry,
} from '../../database/entities';
import { ConstructionMovEntryRepository } from '../repository/construction-mov-entry.repository';
import { ConstructionMilestoneRepository } from '../repository/construction-milestone.repository';
import { ConstructionTimelineEntryRepository } from '../repository/construction-timeline-entry.repository';
import { ConstructionAccessService } from './construction-access.service';
import { ActivityAction } from '../../activity-logs/activity-log.entity';
import { UploadsService } from '../../uploads';
import { UploadProgressService } from '../../uploads/upload-progress.service';
import { JwtPayload } from '../../common/interfaces';
import { CreateMovEntryDto } from '../dto';

/**
 * MOV (means of verification) evidence entries, Phase KO. Split out of
 * ConstructionProjectsService; the URLs and behaviour are unchanged.
 */
@Injectable()
export class MovService {
  private readonly logger = new Logger(MovService.name);

  constructor(
    @InjectRepository(ConstructionMovEntry)
    private readonly movEntryRepo: ConstructionMovEntryRepository,
    @InjectRepository(ConstructionMilestone)
    private readonly milestoneRepo: ConstructionMilestoneRepository,
    @InjectRepository(ConstructionTimelineEntry)
    private readonly timelineEntryRepo: ConstructionTimelineEntryRepository,
    private readonly access: ConstructionAccessService,
    private readonly uploadsService: UploadsService,
    private readonly uploadProgress: UploadProgressService,
  ) {}

  async listMovEntries(
    projectId: string,
    relatedEntityType?: 'MILESTONE' | 'TIMELINE_ENTRY',
    relatedEntityId?: string,
  ): Promise<ConstructionMovEntry[]> {
    await this.access.assertProjectExists(projectId);
    const where: FilterQuery<ConstructionMovEntry> = { projectId };
    if (relatedEntityType) where.relatedEntityType = relatedEntityType;
    if (relatedEntityId) where.relatedEntityId = relatedEntityId;
    return this.movEntryRepo.find(where, {
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMovEntry(
    projectId: string,
    dto: CreateMovEntryDto,
    userId: string,
    user?: JwtPayload,
  ): Promise<ConstructionMovEntry> {
    await this.access.assertProjectExists(projectId);
    // Record-scope guard: a MOV entry is project evidence, so creating one is a write on the
    // project and needs the same assignment check as any other sub-resource.
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        userId,
        user,
        'canCreate',
      );

    // Validate the related entity exists and belongs to this project
    if (dto.related_entity_type === 'MILESTONE') {
      const m = await this.milestoneRepo.findOneForProject(
        projectId,
        dto.related_entity_id,
      );
      if (!m)
        throw new NotFoundException(
          `Milestone ${dto.related_entity_id} not found in project ${projectId}`,
        );
    } else {
      const t = await this.timelineEntryRepo.findOneForProject(
        projectId,
        dto.related_entity_id,
      );
      if (!t)
        throw new NotFoundException(
          `Timeline entry ${dto.related_entity_id} not found in project ${projectId}`,
        );
    }

    const entity = this.movEntryRepo.create({
      projectId,
      relatedEntityType: dto.related_entity_type,
      relatedEntityId: dto.related_entity_id,
      movLink: dto.mov_link || undefined,
      movTitle: dto.mov_title,
      movDescription: dto.mov_description,
      evidenceCategory: dto.evidence_category || 'other',
      entryDate: dto.entry_date ? new Date(dto.entry_date) : undefined,
      uploadedBy: userId,
      remarks: dto.remarks,
    });
    await this.movEntryRepo.getEntityManager().persist(entity).flush();
    this.logger.log(
      `MOV_ENTRY_CREATED: id=${entity.id}, project=${projectId}, by=${userId}`,
    );
    this.access.fireLog(user, ActivityAction.CREATE, projectId, {
      movEntryId: entity.id,
      relatedEntityType: dto.related_entity_type,
      relatedEntityId: dto.related_entity_id,
    });
    return entity;
  }

  async deleteMovEntry(
    projectId: string,
    movEntryId: string,
    userId: string,
    user?: JwtPayload,
  ): Promise<void> {
    await this.access.assertProjectExists(projectId);
    // Record-scope guard — deleting evidence is a write on the project.
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        userId,
        user,
        'canDelete',
      );
    const count = await this.movEntryRepo.nativeDelete({
      id: movEntryId,
      projectId,
    });
    if (count === 0)
      throw new NotFoundException(`MOV entry ${movEntryId} not found`);
    this.logger.log(
      `MOV_ENTRY_DELETED: id=${movEntryId}, project=${projectId}, by=${userId}`,
    );
    this.access.fireLog(user, ActivityAction.DELETE, projectId, {
      movEntryId,
    });
  }

  // LC-C: Upload a file as MOV evidence for an existing MOV entry
  /**
   * Attach a file to an existing MOV entry.
   *
   * Reports the same upload phases as the document and gallery paths, so every file a user
   * can send from the COI screens is tracked the same way.
   */
  async uploadMovFile(
    projectId: string,
    movEntryId: string,
    file: Express.Multer.File,
    userId: string,
    uploadId?: string,
    // Optional so existing call sites keep compiling; the controller always passes it, and
    // without it the record-scope guard below cannot run.
    user?: JwtPayload,
  ): Promise<ConstructionMovEntry> {
    // Record-scope guard, before any progress channel is opened — a caller with no claim on
    // the project should be refused rather than handed a live upload channel.
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        userId,
        user,
        'canUpload',
      );
    if (uploadId) this.uploadProgress.open(uploadId, userId);
    this.uploadProgress.emit(uploadId, userId, 'received', {
      fileName: file?.originalname,
    });
    try {
      const entry = await this.persistMovFile(
        projectId,
        movEntryId,
        file,
        userId,
        uploadId,
      );
      this.uploadProgress.finish(uploadId, userId, {
        fileName: file?.originalname,
      });
      return entry;
    } catch (err) {
      this.uploadProgress.fail(
        uploadId,
        userId,
        err instanceof HttpException ? err.message : 'Upload failed',
        { fileName: file?.originalname },
      );
      throw err;
    }
  }

  private async persistMovFile(
    projectId: string,
    movEntryId: string,
    file: Express.Multer.File,
    userId: string,
    uploadId?: string,
  ): Promise<ConstructionMovEntry> {
    await this.access.assertProjectExists(projectId);
    const entry = await this.movEntryRepo.findOne({
      id: movEntryId,
      projectId,
    });
    if (!entry)
      throw new NotFoundException(`MOV entry ${movEntryId} not found`);
    if (!file) throw new BadRequestException('File is required');

    this.uploadProgress.emit(uploadId, userId, 'validating', {
      fileName: file.originalname,
    });
    this.uploadsService.validateFile(file);
    this.uploadProgress.emit(uploadId, userId, 'storing', {
      fileName: file.originalname,
    });
    const uploadResult = await this.uploadsService.uploadFile(
      file,
      userId,
      'construction_mov',
      projectId,
    );
    this.uploadProgress.emit(uploadId, userId, 'stored', {
      fileName: uploadResult.originalName,
    });
    entry.filePath = uploadResult.filePath;
    entry.fileName = file.originalname;
    entry.fileSize = file.size;
    entry.mimeType = file.mimetype;
    this.uploadProgress.emit(uploadId, userId, 'persisting', {
      fileName: file.originalname,
    });
    await this.movEntryRepo.getEntityManager().flush();
    this.logger.log(
      `MOV_FILE_UPLOADED: id=${movEntryId}, project=${projectId}, by=${userId}`,
    );
    return entry;
  }
}
