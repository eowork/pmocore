import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
  Sse,
  Headers,
  MessageEvent,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConstructionProjectsService } from './construction-projects.service';
import {
  CreateConstructionProjectDto,
  UpdateConstructionProjectDto,
  QueryConstructionProjectDto,
  UploadDocumentDto,
  // NI: CreateConstructionFinancialDto removed
  CreateDocumentFolderDto,
  UpdateDocumentFolderDto,
} from './dto';
import { JwtAuthGuard, RolesGuard, ModuleAccessGuard } from '../auth/guards';
import { UploadProgressService } from '../uploads/upload-progress.service';
import { Roles, CurrentUser, RequireModule } from '../auth/decorators';
import { JwtPayload } from '../common/interfaces';

@ApiTags('Construction Projects')
@ApiBearerAuth('JWT-auth')
@Controller('construction-projects')
// PHASE BBBA (BBBA-1c): default-DENY module access. Public surface lives in the
// separate PublicConstructionController, so gating the whole class is safe.
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@RequireModule('coi')
export class ConstructionProjectsController {
  constructor(
    private readonly service: ConstructionProjectsService,
    private readonly uploadProgress: UploadProgressService,
  ) {}

  // --- Read Operations: All authenticated roles can view ---

  @Get()
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({
    summary:
      'List construction projects (Admin/SuperAdmin see all; everyone else sees only created/assigned)',
  })
  findAll(
    @Query() query: QueryConstructionProjectDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(query, user);
  }

  @Get('analytics/summary')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({
    summary:
      'COI analytics summary — counts by status, campus, publication_status',
  })
  getAnalyticsSummary() {
    return this.service.getAnalyticsSummary();
  }

  @Get('analytics/financial-summary')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({
    summary:
      'COI financial analytics — aggregated appropriation, obligation, disbursement',
  })
  getFinancialSummary() {
    return this.service.getFinancialSummary();
  }

  @Get('pending-review')
  @Roles()
  @ApiOperation({ summary: 'List drafts pending review (Admin only)' })
  findPendingReview(@CurrentUser() user: JwtPayload) {
    return this.service.findPendingReview(user);
  }

  @Get('my-drafts')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'List current user drafts' })
  findMyDrafts(@CurrentUser() user: JwtPayload) {
    return this.service.findMyDrafts(user.sub);
  }

  // VE-A: per-project permission map for the current user (static; must precede :id)
  @Get('my-permissions')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({
    summary:
      'Get the current user project-level permission map (projectId → permissions)',
  })
  getMyPermissions(@CurrentUser() user: JwtPayload) {
    return this.service.getMyProjectPermissions(user.sub);
  }

  @Get('/code/availability')
  @Roles()
  @ApiOperation({
    summary: 'Check if a construction project code is available',
  })
  checkCodeAvailability(@Query('code') code: string) {
    return this.service.checkCodeAvailability(code);
  }

  @Get(':id')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'Get construction project details' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findOne(id, user);
  }

  // --- Create/Update Operations: Admin and Staff ---

  @Post()
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create construction project (Admin=PUBLISHED, Staff=DRAFT)',
  })
  create(
    @Body() dto: CreateConstructionProjectDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(dto, user.sub, user);
  }

  // --- Draft Governance Workflow ---

  @Post(':id/submit-for-review')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit draft for admin review (owner only)' })
  submitForReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.submitForReview(id, user.sub, user);
  }

  // Phase BBCH (Track 1): role gate relaxed — authority is now Admin OR an
  // Approver/Manager 'coi' module-level grant, enforced inside the service via
  // permissionResolver.canApproveModule(). @Roles('Admin') here would have blocked
  // a module-level Approver/Manager before the service check ever ran.
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Publish (approve) a draft (Admin, or Approver/Manager module level)',
  })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.publish(id, user.sub, user);
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Approve (publish) a draft (Admin, or Approver/Manager module level) — alias for /publish',
  })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.publish(id, user.sub, user);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Reject a draft with notes (Admin, or Approver/Manager module level)',
  })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('notes') notes: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.reject(id, user.sub, notes, user);
  }

  @Post(':id/withdraw')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw pending submission (submitter only)' })
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.withdraw(id, user.sub, user);
  }

  @Patch(':id')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'Update construction project (Admin/Staff)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConstructionProjectDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub, user);
  }

  // --- Delete Operations: Admin, project owner, or a record-level canDelete grant ---

  @Delete(':id')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete construction project (Admin, owner, or record-level canDelete)',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.remove(id, user.sub, user);
  }

  // --- POW routes REMOVED (Phase ME, 2026-05-21) ---

  // NI (2026-05-21): /financials routes REMOVED — superseded by /progress-reports.

  // ============================================================
  // Phase JN-D: Document / Attachment / External Link Endpoints
  // ============================================================

  @Get(':id/documents')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List project documents (files + Drive links)' })
  async listDocuments(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.listProjectDocuments(id);
    return { data };
  }

  @Get(':id/document-folders')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List project document folders as a nested tree' })
  async listDocumentFolders(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.listDocumentFolders(id);
    return { data };
  }

  @Post(':id/document-folders')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a document folder node under a project' })
  createDocumentFolder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDocumentFolderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createDocumentFolder(id, dto, user);
  }

  @Patch(':id/document-folders/:folderId')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'Update a document folder node' })
  updateDocumentFolder(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('folderId', ParseUUIDPipe) folderId: string,
    @Body() dto: UpdateDocumentFolderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateDocumentFolder(id, folderId, dto, user);
  }

  @Delete(':id/document-folders/:folderId')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an empty document folder node' })
  async removeDocumentFolder(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('folderId', ParseUUIDPipe) folderId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.service.removeDocumentFolder(id, folderId, user);
  }

  @Post(':id/documents')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024, // 20MB — larger than gallery to support docs
      },
    }),
  )
  @ApiOperation({
    summary:
      'Upload a document (file ≤20MB) OR register an external Google Drive link (Admin/Staff)',
  })
  uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: JwtPayload,
    // Optional: the id of the SSE channel the client opened before sending the file.
    // Sent as a header rather than a form field because the body is validated against
    // UploadDocumentDto with forbidNonWhitelisted, and because it is transport metadata
    // rather than part of the document.
    @Headers('x-upload-id') uploadId?: string,
  ) {
    return this.service.addDocumentToProject(
      id,
      file,
      dto,
      user.sub,
      user,
      uploadId,
    );
  }

  // Server-Sent Events channel for one upload.
  //
  // The client generates the uploadId, subscribes here FIRST, then POSTs the file with the
  // same id in X-Upload-Id. Events already emitted are replayed on subscribe, so the order
  // is a convenience rather than a race to win, and the stream completes on done/failed.
  //
  // Consume it with fetch + ReadableStream, not EventSource: EventSource cannot send an
  // Authorization header, and this route is behind the same JWT and module guards as the
  // rest of the controller. The channel is bound to the subscribing user, so one user
  // cannot attach to another user's upload and read their file names.
  @Sse(':id/uploads/progress/:uploadId')
  @Roles() // any authenticated user with 'coi' access; the channel itself is owner-scoped
  @ApiOperation({
    summary:
      'Live progress for one file upload — document or gallery image (Server-Sent Events)',
  })
  uploadProgressStream(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
    @CurrentUser() user: JwtPayload,
  ): Observable<MessageEvent> {
    return this.uploadProgress.stream(uploadId, user.sub);
  }

  // JQ-C-2: Delete a document or external link from a project.
  // No quarter-scoping (per JQ-D8: COI is not quarter-scoped).
  @Delete(':id/documents/:docId')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a document (Admin only); physical file preserved',
  })
  async removeDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.service.removeDocument(id, docId, user);
  }

  // CCC-A: Stream a stored document with its original filename + DOWNLOAD audit
  @Get(':id/documents/:docId/download')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({
    summary: 'Stream a stored document with original filename + DOWNLOAD audit',
  })
  downloadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return this.service.streamDocument(id, docId, user, res);
  }
}
