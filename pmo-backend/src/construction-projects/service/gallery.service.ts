import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { FilterQuery, QueryOrder } from '@mikro-orm/core';
import { ConstructionGallery } from '../../database/entities';
import { ConstructionGalleryRepository } from '../repository/construction-gallery.repository';
import { ConstructionAccessService } from './construction-access.service';
import { ActivityAction } from '../../activity-logs/activity-log.entity';
import { UploadsService } from '../../uploads';
import { UploadProgressService } from '../../uploads/upload-progress.service';
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto';
import { JwtPayload } from '../../common/interfaces';
import { CreateGalleryDto, QueryGalleryDto } from '../dto';

/**
 * Project gallery. Split out of ConstructionProjectsService; the URLs and behaviour are
 * unchanged.
 */
@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);

  constructor(
    @InjectRepository(ConstructionGallery)
    private readonly galleryRepo: ConstructionGalleryRepository,
    private readonly access: ConstructionAccessService,
    private readonly uploadsService: UploadsService,
    private readonly uploadProgress: UploadProgressService,
  ) {}

  async findGallery(
    projectId: string,
    query: QueryGalleryDto,
  ): Promise<PaginatedResponse<ConstructionGallery>> {
    await this.access.assertProjectExists(projectId);

    const { page = 1, limit = 20, sort = 'uploadedAt', order = 'desc' } = query;
    type sortKeyType = 'uploadedAt' | 'category';

    const sortKey: sortKeyType = ['uploadedAt', 'category'].includes(sort)
      ? (sort as sortKeyType)
      : 'uploadedAt';

    const sortOrder = (order.toLowerCase() === 'asc' ? 'asc' : 'desc') as
      | 'asc'
      | 'desc';

    const where: FilterQuery<ConstructionGallery> = { projectId };
    if (query.category) where.category = query.category;

    const [items, total] = await this.galleryRepo.findAndCount(where, {
      limit,
      offset: (page - 1) * limit,
      orderBy: {
        [sortKey]: sortOrder == 'asc' ? QueryOrder.ASC : QueryOrder.DESC,
      },
    });

    return createPaginatedResponse(items, total, page, limit);
  }

  async findGalleryItem(
    projectId: string,
    galleryId: string,
  ): Promise<ConstructionGallery> {
    await this.access.assertProjectExists(projectId);
    const entity = await this.galleryRepo.findOne({ id: galleryId, projectId });
    if (!entity)
      throw new NotFoundException(`Gallery item ${galleryId} not found`);
    return entity;
  }

  /**
   * Upload a gallery image.
   *
   * Reports the same phases as a document upload over the caller's SSE channel, for the
   * same reason: once the browser has sent the last byte it cannot see the storage write
   * or the database commit, and a 10 MB photo spends real time in both.
   */
  async createGalleryItem(
    projectId: string,
    file: Express.Multer.File,
    dto: CreateGalleryDto,
    userId: string,
    user?: JwtPayload,
    uploadId?: string,
  ): Promise<ConstructionGallery> {
    if (uploadId) this.uploadProgress.open(uploadId, userId);
    this.uploadProgress.emit(uploadId, userId, 'received', {
      fileName: file?.originalname,
    });
    try {
      const entity = await this.persistGalleryItem(
        projectId,
        file,
        dto,
        userId,
        user,
        uploadId,
      );
      this.uploadProgress.finish(uploadId, userId, {
        fileName: file?.originalname,
      });
      return entity;
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

  private async persistGalleryItem(
    projectId: string,
    file: Express.Multer.File,
    dto: CreateGalleryDto,
    userId: string,
    user?: JwtPayload,
    uploadId?: string,
  ): Promise<ConstructionGallery> {
    await this.access.assertProjectExists(projectId);
    // Record-scope guard, at the single choke point the upload route and any future caller
    // both pass through.
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        userId,
        user,
        'canUpload',
      );

    if (!file) throw new BadRequestException('Image file is required');

    // KF-AB: PROFILE category is limited to 3 images per project
    if (dto.category === 'PROFILE') {
      const profileCount = await this.galleryRepo.count({
        projectId,
        category: 'PROFILE',
      });
      if (profileCount >= 3) {
        throw new BadRequestException(
          'Maximum 3 PROFILE images allowed per project',
        );
      }
    }

    this.uploadProgress.emit(uploadId, userId, 'validating', {
      fileName: file.originalname,
    });
    // Reject an oversized or wrong-typed image before the storage write, so the failure is
    // reported against the phase that actually rejected it.
    this.uploadsService.validateFile(file);
    this.uploadProgress.emit(uploadId, userId, 'storing', {
      fileName: file.originalname,
    });
    const uploadResult = await this.uploadsService.uploadFile(
      file,
      userId,
      'construction_gallery',
      projectId,
    );
    this.uploadProgress.emit(uploadId, userId, 'stored', {
      fileName: uploadResult.originalName,
    });

    const entity = this.galleryRepo.create({
      projectId,
      imageUrl: uploadResult.filePath,
      caption: dto.caption,
      category: dto.category || 'IN_PROGRESS',
      isFeatured: dto.is_featured || false,
      // LB-C: persist user-supplied photo capture date when provided
      imageTakenDate: dto.image_taken_date
        ? new Date(dto.image_taken_date)
        : undefined,
    });
    this.uploadProgress.emit(uploadId, userId, 'persisting', {
      fileName: file.originalname,
    });
    await this.galleryRepo.getEntityManager().persist(entity).flush();

    this.logger.log(
      `GALLERY_CREATED: id=${entity.id}, project=${projectId}, by=${userId}`,
    );
    this.access.fireLog(user, ActivityAction.UPLOAD, projectId, {
      section: dto.category === 'PROFILE' ? 'GALLERY_PROFILE' : 'GALLERY',
      galleryId: entity.id,
      category: entity.category,
    });
    return entity;
  }

  async updateGalleryItem(
    projectId: string,
    galleryId: string,
    dto: Partial<CreateGalleryDto>,
    userId: string,
    // Optional so existing call sites keep compiling; the controller always passes it.
    user?: JwtPayload,
  ): Promise<ConstructionGallery> {
    const entity = await this.findGalleryItem(projectId, galleryId);
    // Record-scope guard — editing a caption or category is still a project write.
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        userId,
        user,
        'canEdit',
      );

    if (dto.caption !== undefined) entity.caption = dto.caption;
    if (dto.category !== undefined) entity.category = dto.category;
    if (dto.is_featured !== undefined) entity.isFeatured = dto.is_featured;
    if (dto.image_taken_date !== undefined)
      entity.imageTakenDate = dto.image_taken_date
        ? new Date(dto.image_taken_date)
        : undefined;
    await this.galleryRepo.getEntityManager().flush();

    this.logger.log(`GALLERY_UPDATED: id=${galleryId}, by=${userId}`);
    return entity;
  }

  async removeGalleryItem(
    projectId: string,
    galleryId: string,
    userId: string,
    user?: JwtPayload,
  ): Promise<void> {
    if (user)
      await this.access.assertProjectPermission(
        projectId,
        userId,
        user,
        'canDelete',
      );
    const entity = await this.findGalleryItem(projectId, galleryId);

    if (entity.imageUrl) {
      await this.uploadsService.deleteFile(entity.imageUrl);
    }

    await this.galleryRepo.nativeDelete({ id: galleryId });
    this.logger.log(`GALLERY_DELETED: id=${galleryId}, by=${userId}`);
    this.access.fireLog(user, ActivityAction.REMOVE_ATTACHMENT, projectId, {
      section: 'GALLERY',
      galleryId,
    });
  }
}
