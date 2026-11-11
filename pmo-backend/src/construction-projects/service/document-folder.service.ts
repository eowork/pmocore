import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { ConstructionDocumentFolder } from '../../database/entities';
import { ConstructionDocumentFolderRepository } from '../repository/construction-document-folder.repository';

@Injectable()
export class DocumentFolderService {
  constructor(
    @InjectRepository(ConstructionDocumentFolder)
    private readonly folderRepository: ConstructionDocumentFolderRepository,
  ) {}

  findAllDocumentFolder(){
    return this.folderRepository.findAll();
  }
}
