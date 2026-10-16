import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CurrentUser,
  JwtAuthGuard,
  ModuleAccessGuard,
  RequireModule,
  Roles,
  RolesGuard,
} from '../../auth';
import { DocumentTypeService } from '../service/document-type.service';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Construction Projects Document Type')
@ApiBearerAuth('JWT-auth')
@Controller('construction-projects')
// PHASE BBBA (BBBA-1c): default-DENY module access. Public surface lives in the
// separate PublicConstructionController, so gating the whole class is safe.
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@RequireModule('coi')
export class DocumentTypeController {
  constructor(private readonly service: DocumentTypeService) {}

  // These are static two-segment paths. The module lists this controller before
  // ConstructionProjectsController so they are matched ahead of its ':id' route, which
  // would otherwise swallow 'document-types' and fail its ParseUUIDPipe.
  @Get('document-types')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List all CPES document types (reference)' })
  findDocumentTypes() {
    return this.service.findDocumentTypes();
  }

  // ZX-3: Grouped document types for the attachment hub
  @Get('document-types/grouped')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List document types grouped by group_code' })
  findDocumentTypesGrouped() {
    return this.service.findDocumentTypesGrouped();
  }

  // ZX-3: Flat templateUrl status map
  @Get('document-types/template-status')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({
    summary: 'Flat map of typeCode → templateUrl for all active types',
  })
  getDocumentTypeTemplateStatus() {
    return this.service.getDocumentTypeTemplateStatus();
  }

  // ZT-7: Admin uploads a blank template for a document type
  @Post('document-types/:typeId/template')
  @Roles('Admin', 'SuperAdmin')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  @ApiOperation({
    summary: 'Upload blank form template for a document type (Admin only)',
  })
  uploadDocumentTypeTemplate(
    @Param('typeId', ParseUUIDPipe) typeId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.uploadDocumentTypeTemplate(typeId, file, user.sub);
  }
}
