import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { DocumentChecklistService } from '../service/document-checklist.service';
import {
  ChangeChecklistDocumentTypeDto,
  UpdateDocumentChecklistDto,
} from '../dto';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Construction Projects Document Checklist')
@ApiBearerAuth('JWT-auth')
@Controller('construction-projects')
// PHASE BBBA (BBBA-1c): default-DENY module access. Public surface lives in the
// separate PublicConstructionController, so gating the whole class is safe.
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@RequireModule('coi')
export class DocumentChecklistController {
  constructor(private readonly service: DocumentChecklistService) {}

  @Get(':id/document-checklist')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({
    summary:
      'Get per-project document compliance checklist (lazy-initialized on first call)',
  })
  findDocumentChecklist(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findDocumentChecklist(id);
  }

  @Patch(':id/document-checklist/:itemId')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'Update document checklist item (Admin/Staff)' })
  updateDocumentChecklistItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateDocumentChecklistDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateDocumentChecklistItem(
      id,
      itemId,
      dto,
      user.sub,
      user,
    );
  }

  @Patch(':id/document-checklist/:itemId/change-document-type')
  @Roles('Admin', 'Staff')
  @ApiOperation({
    summary: 'Change document type for a checklist item (Admin/Staff)',
  })
  changeChecklistDocumentType(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ChangeChecklistDocumentTypeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.changeChecklistDocumentType(id, itemId, dto, user);
  }

  @Patch(':id/document-remarks')
  @Roles('Admin', 'Staff')
  @ApiOperation({
    summary: 'Update per-group document checklist remarks (KV-D2)',
  })
  updateDocumentRemarks(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { groupCode: string; remarks: unknown },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateDocumentRemarks(
      id,
      body.groupCode,
      body.remarks,
      user.sub,
      user,
    );
  }

  @Patch(':id/custom-key-sections')
  @Roles('Admin', 'Staff')
  @ApiOperation({
    summary: 'Replace per-project custom Key Document sections (AAA-F-3)',
  })
  updateCustomKeySections(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: { sections: Array<{ id: string; label: string; typeCode: string }> },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateCustomKeySections(id, body.sections ?? [], user);
  }

  @Patch(':id/custom-supporting-sections')
  @Roles('Admin', 'Staff')
  @ApiOperation({
    summary: 'Replace per-project custom Supporting Document folders (SSS-B)',
  })
  updateCustomSupportingSections(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: { sections: Array<{ id: string; label: string; typeCode: string }> },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateCustomSupportingSections(
      id,
      body.sections ?? [],
      user,
    );
  }

  // ZT-7: Submission history for a checklist item
  @Get(':id/document-checklist/:itemId/submissions')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List submission versions for a checklist item' })
  getDocumentSubmissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.service.getDocumentSubmissions(id, itemId);
  }

  // ZT-7: Submit a new version for a checklist item
  @Post(':id/document-checklist/:itemId/submissions')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  @ApiOperation({
    summary: 'Submit a new document version for a checklist item (Admin/Staff)',
  })
  submitDocumentVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('notes') notes: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.submitDocumentVersion(id, itemId, file, notes, user);
  }
}
