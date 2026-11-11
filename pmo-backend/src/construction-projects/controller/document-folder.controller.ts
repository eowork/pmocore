import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, ModuleAccessGuard, RolesGuard } from '../../auth';
import { DocumentFolderService } from '../service/document-folder.service';

@ApiTags('Construction Projects Document Folder')
@ApiBearerAuth('JWT-auth')
@Controller('project-document-folders')
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
export class DocumentFolderController {
  constructor(private readonly documentFolderService: DocumentFolderService) {}
}