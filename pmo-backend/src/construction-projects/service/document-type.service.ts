import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { QueryOrder } from '@mikro-orm/core';
import { ConstructionDocumentType } from '../../database/entities';
import { ConstructionDocumentTypeRepository } from '../repository/construction-document-type.repository';
import { UploadsService } from '../../uploads';

/**
 * CPES document types: the admin-managed reference list behind the checklist and the
 * attachment hub. Split out of ConstructionProjectsService; the URLs and behaviour are
 * unchanged.
 */
@Injectable()
export class DocumentTypeService {
  constructor(
    @InjectRepository(ConstructionDocumentType)
    private readonly docTypeRepo: ConstructionDocumentTypeRepository,
    private readonly uploadsService: UploadsService,
  ) {}

  /**
   * KB-E: Returns admin-managed reference list of all CPES document types.
   * Used by frontend to render checklist categories and admin extension UI.
   */
  async findDocumentTypes(): Promise<ConstructionDocumentType[]> {
    return await this.docTypeRepo.find(
      { isActive: true },
      { orderBy: { groupCode: QueryOrder.ASC, sortOrder: QueryOrder.ASC } },
    );
  }

  /**
   * ZX-1: Returns document types grouped by group_code for the attachment hub.
   * Backward-compatible — flat `findDocumentTypes()` remains unchanged.
   */
  async findDocumentTypesGrouped(): Promise<
    {
      groupCode: string;
      groupLabel: string;
      types: ConstructionDocumentType[];
    }[]
  > {
    const all = await this.docTypeRepo.find(
      { isActive: true },
      {
        orderBy: [{ groupCode: QueryOrder.ASC }, { sortOrder: QueryOrder.ASC }],
      },
    );
    const groups = new Map<
      string,
      {
        groupCode: string;
        groupLabel: string;
        types: ConstructionDocumentType[];
      }
    >();
    for (const t of all) {
      if (!groups.has(t.groupCode)) {
        groups.set(t.groupCode, {
          groupCode: t.groupCode,
          groupLabel: t.groupLabel,
          types: [],
        });
      }
      groups.get(t.groupCode)!.types.push(t);
    }
    return Array.from(groups.values());
  }

  /**
   * ZX-2: Flat map of typeCode → templateUrl for all active document types.
   * Lets the hub show "template-available" indicators without re-fetching
   * the full type list.
   */
  async getDocumentTypeTemplateStatus(): Promise<
    { typeCode: string; templateUrl: string | null }[]
  > {
    const docTypes = await this.docTypeRepo.find(
      { isActive: true },
      {
        orderBy: [{ groupCode: QueryOrder.ASC }, { sortOrder: QueryOrder.ASC }],
      },
    );
    return docTypes.map((t) => ({
      typeCode: t.typeLabel,
      templateUrl: t.templateUrl ?? null,
    }));
  }

  // ZT-6: Admin uploads a blank template file for a document type
  async uploadDocumentTypeTemplate(
    typeId: string,
    file: Express.Multer.File,
    userId: string,
  ): Promise<ConstructionDocumentType> {
    const docType = await this.docTypeRepo.findOne({ id: typeId });
    if (!docType)
      throw new NotFoundException(`Document type ${typeId} not found`);
    const upload = await this.uploadsService.uploadFile(
      file,
      userId,
      'coi-templates',
    );
    docType.templateUrl = upload.filePath;
    await this.docTypeRepo.getEntityManager().flush();
    return docType;
  }
}
