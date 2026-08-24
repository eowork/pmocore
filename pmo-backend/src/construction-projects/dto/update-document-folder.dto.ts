import { PartialType } from '@nestjs/mapped-types';
import { CreateDocumentFolderDto } from './create-document-folder.dto';

export class UpdateDocumentFolderDto extends PartialType(
  CreateDocumentFolderDto,
) {}
