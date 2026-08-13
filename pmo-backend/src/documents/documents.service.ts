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
import { CreateDocumentDto, UpdateDocumentDto, QueryDocumentDto } from './dto';
import { Document } from '../database/entities';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly ALLOWED_SORTS = ['createdAt', 'documentType', 'fileName'];
  private readonly ALLOWED_ENTITY_TYPES = [
    'project',
    'construction_project',
    'repair_project',
    'university_operation',
  ];

  constructor(
    @InjectRepository(Document)
    private readonly docRepo: EntityRepository<Document>,
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
    query: QueryDocumentDto,
  ): Promise<PaginatedResponse<Document>> {
    this.validateEntityType(entityType);

    const { page = 1, limit = 20, sort = 'createdAt', order = 'desc' } = query;

    const sortKey = this.ALLOWED_SORTS.includes(sort) ? sort : 'createdAt';
    const sortOrder = (order.toLowerCase() === 'asc' ? 'asc' : 'desc') as
      | 'asc'
      | 'desc';

    const where: FilterQuery<Document> = {
      documentableType: entityType,
      documentableId: entityId,
    };

    if (query.document_type) {
      where.documentType = query.document_type;
    }
    if (query.category) {
      where.category = query.category;
    }

    const [items, total] = await this.docRepo.findAndCount(where, {
      limit,
      offset: (page - 1) * limit,
      orderBy: { [sortKey]: sortOrder },
    });

    return createPaginatedResponse(items, total, page, limit);
  }

  async findOne(id: string): Promise<Document> {
    const entity = await this.docRepo.findOne({ id });
    if (!entity) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }
    return entity;
  }

  async create(
    entityType: string,
    entityId: string,
    file: Express.Multer.File,
    dto: CreateDocumentDto,
    userId: string,
  ): Promise<Document> {
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

    const entity = this.docRepo.create({
      documentableType: entityType,
      documentableId: entityId,
      documentType: dto.document_type,
      fileName: uploadResult.originalName,
      filePath: uploadResult.filePath,
      fileSize: uploadResult.fileSize,
      mimeType: uploadResult.mimeType,
      description: dto.description,
      category: dto.category,
      uploadedBy: userId,
      createdBy: userId,
    });

    await this.em.persist(entity).flush();
    this.logger.log(
      `DOCUMENT_CREATED: id=${entity.id}, entity=${entityType}/${entityId}, by=${userId}`,
    );
    return entity;
  }

  async update(
    id: string,
    dto: UpdateDocumentDto,
    userId: string,
  ): Promise<Document> {
    const entity = await this.findOne(id);

    if (dto.document_type !== undefined)
      entity.documentType = dto.document_type;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.category !== undefined) entity.category = dto.category;
    entity.updatedBy = userId;

    await this.em.flush();

    const fields = Object.keys(dto).filter(
      (k) => (dto as any)[k] !== undefined,
    );
    this.logger.log(
      `DOCUMENT_UPDATED: id=${id}, by=${userId}, fields=[${fields.join(',')}]`,
    );
    return entity;
  }

  async remove(id: string, userId: string): Promise<void> {
    const entity = await this.findOne(id);

    // Soft-delete: set deletedAt; do NOT call uploadsService.deleteFile().
    // The stored file is retained for compliance so the record stays auditable
    // and restorable — a row marked recoverable whose bytes were destroyed is
    // not recoverable. Same rule as construction-projects removeDocument().
    entity.deletedAt = new Date();
    entity.deletedBy = userId;
    await this.em.flush();

    this.logger.log(`DOCUMENT_DELETED: id=${id}, by=${userId}`);
  }
}
