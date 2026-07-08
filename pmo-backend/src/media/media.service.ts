import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import type { FilterQuery } from '@mikro-orm/core';
import { createPaginatedResponse, PaginatedResponse } from '../common/dto';
import { UploadsService } from '../uploads/uploads.service';
import { CreateMediaDto, UpdateMediaDto, QueryMediaDto } from './dto';
import { Media } from '../database/entities';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly ALLOWED_SORTS = [
    'createdAt',
    'mediaType',
    'title',
    'fileName',
  ];
  private readonly ALLOWED_ENTITY_TYPES = [
    'project',
    'construction_project',
    'repair_project',
    'university_operation',
    // T-HOME-CMS (THC-2): homepage CMS images (carousel slides, card banners).
    'homepage_hero',
    'homepage_carousel',
    'homepage_card',
    // T-HOME-CMS-5 (TH5-6): custom SVG/PNG icon uploads for icon-only sections.
    'homepage_icon',
  ];

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepo: EntityRepository<Media>,
    private readonly em: EntityManager,
    private readonly uploadsService: UploadsService,
  ) {}

  private validateEntityType(entityType: string): void {
    if (!this.ALLOWED_ENTITY_TYPES.includes(entityType)) {
      throw new BadRequestException(
        `Invalid entity type: ${entityType}. Allowed: ${this.ALLOWED_ENTITY_TYPES.join(', ')}`,
      );
    }
  }

  async findAllForEntity(
    entityType: string,
    entityId: string,
    query: QueryMediaDto,
  ): Promise<PaginatedResponse<Media>> {
    this.validateEntityType(entityType);

    const { page = 1, limit = 20, sort = 'createdAt', order = 'desc' } = query;

    const sortKey = this.ALLOWED_SORTS.includes(sort) ? sort : 'createdAt';
    const sortOrder = (order.toLowerCase() === 'asc' ? 'asc' : 'desc') as
      | 'asc'
      | 'desc';

    const where: FilterQuery<Media> = {
      mediableType: entityType,
      mediableId: entityId,
    };

    if (query.media_type) {
      where.mediaType = query.media_type;
    }
    if (query.title) {
      where.title = { $ilike: `%${query.title}%` };
    }

    const [items, total] = await this.mediaRepo.findAndCount(where, {
      limit,
      offset: (page - 1) * limit,
      orderBy: { [sortKey]: sortOrder },
    });

    return createPaginatedResponse(items, total, page, limit);
  }

  async findOne(id: string): Promise<Media> {
    const entity = await this.mediaRepo.findOne({ id });
    if (!entity) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }
    return entity;
  }

  async create(
    entityType: string,
    entityId: string,
    file: Express.Multer.File,
    dto: CreateMediaDto,
    userId: string,
  ): Promise<Media> {
    this.validateEntityType(entityType);

    if (!file) {
      throw new BadRequestException('File is required');
    }

    const uploadResult = await this.uploadsService.uploadFile(
      file,
      userId,
      entityType,
      entityId,
    );

    const entity = this.mediaRepo.create({
      mediableType: entityType,
      mediableId: entityId,
      mediaType: dto.media_type,
      fileName: uploadResult.originalName,
      filePath: uploadResult.filePath,
      fileSize: uploadResult.fileSize,
      mimeType: uploadResult.mimeType,
      title: dto.title,
      description: dto.description,
      altText: dto.alt_text,
      uploadedBy: userId,
      createdBy: userId,
    });

    await this.em.persist(entity).flush();
    this.logger.log(
      `MEDIA_CREATED: id=${entity.id}, entity=${entityType}/${entityId}, by=${userId}`,
    );
    return entity;
  }

  async update(
    id: string,
    dto: UpdateMediaDto,
    userId: string,
  ): Promise<Media> {
    const entity = await this.findOne(id);

    if (dto.media_type !== undefined) entity.mediaType = dto.media_type;
    if (dto.title !== undefined) entity.title = dto.title;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.alt_text !== undefined) entity.altText = dto.alt_text;
    entity.updatedBy = userId;

    await this.em.flush();

    const fields = Object.keys(dto).filter(
      (k) => (dto as any)[k] !== undefined,
    );
    this.logger.log(
      `MEDIA_UPDATED: id=${id}, by=${userId}, fields=[${fields.join(',')}]`,
    );
    return entity;
  }

  async remove(id: string, userId: string): Promise<void> {
    const entity = await this.findOne(id);

    if (entity.filePath) {
      await this.uploadsService.deleteFile(entity.filePath);
    }

    entity.deletedAt = new Date();
    entity.deletedBy = userId;
    await this.em.flush();

    this.logger.log(`MEDIA_DELETED: id=${id}, by=${userId}`);
  }
}
