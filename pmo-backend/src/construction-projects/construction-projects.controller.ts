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
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConstructionProjectsService } from './construction-projects.service';
import {
  CreateConstructionProjectDto,
  UpdateConstructionProjectDto,
  QueryConstructionProjectDto,
  CreateMilestoneDto,
  CreateGalleryDto,
  QueryGalleryDto,
  UploadDocumentDto,
  CreateTimelineEntryDto,
  UpdateTimelineEntryDto,
  CreateRevisionOrderDto,
  UpdateRevisionOrderDto,
  CreateProgressReportDto,
  UpdateProgressReportDto,
  // NI: CreateConstructionFinancialDto removed
  UpdateDocumentChecklistDto,
  CreateDiaryEntryDto,
  UpdateDiaryEntryDto,
  CreateMovEntryDto,
  BatchCreateMilestoneDto,
  BatchCreateTimelineEntryDto,
  CreateDocumentFolderDto,
  UpdateDocumentFolderDto,
} from './dto';
import { JwtAuthGuard, RolesGuard, ModuleAccessGuard } from '../auth/guards';
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
  constructor(private readonly service: ConstructionProjectsService) {}

  // --- Read Operations: All authenticated roles can view ---

  @Get()
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({
    summary:
      'List all construction projects (non-Admin only see PUBLISHED; Contractors see only assigned)',
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
  @Roles('Admin')
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

  // --- Document Governance reference (static; must precede :id) ---
  @Get('document-types')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List all CPES document types (reference)' })
  findDocumentTypes() {
    return this.service.findDocumentTypes();
  }

  // ZX-3: Grouped document types for the attachment hub (static; must precede :id)
  @Get('document-types/grouped')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List document types grouped by group_code' })
  findDocumentTypesGrouped() {
    return this.service.findDocumentTypesGrouped();
  }

  // ZX-3: Flat templateUrl status map (static; must precede :id)
  @Get('document-types/template-status')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({
    summary: 'Flat map of typeCode → templateUrl for all active types',
  })
  getDocumentTypeTemplateStatus() {
    return this.service.getDocumentTypeTemplateStatus();
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

  @Post(':id/publish')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish (approve) a draft (Admin only)' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.publish(id, user.sub, user);
  }

  @Patch(':id/approve')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve (publish) a draft (Admin only) — alias for /publish',
  })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.publish(id, user.sub, user);
  }

  @Post(':id/reject')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a draft with notes (Admin only)' })
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

  // --- Delete Operations: Admin only ---

  @Delete(':id')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete construction project (Admin only)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.remove(id, user.sub, user);
  }

  // --- Milestones ---

  @Get(':id/milestones')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List project milestones' })
  findMilestones(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findMilestones(id);
  }

  @Post(':id/milestones')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create milestone (Admin/Staff)' })
  createMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMilestoneDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createMilestone(id, dto, user);
  }

  @Patch(':id/milestones/:milestoneId')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'Update milestone (Admin/Staff)' })
  updateMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: Partial<CreateMilestoneDto>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateMilestone(id, milestoneId, dto, user);
  }

  @Delete(':id/milestones/:milestoneId')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete milestone (Admin only)' })
  removeMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeMilestone(id, milestoneId, user);
  }

  // LK-D: Batch create milestones — POST :id/milestones/batch
  @Post(':id/milestones/batch')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Batch create milestones (Admin/Staff, max 50)' })
  batchCreateMilestones(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BatchCreateMilestoneDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.batchCreateMilestones(id, dto, user);
  }

  // LK-F(ctrl): Batch create timeline entries — POST :id/timeline-entries/batch
  @Post(':id/timeline-entries/batch')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Batch create timeline entries (Admin/Staff, max 50)',
  })
  batchCreateTimelineEntries(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BatchCreateTimelineEntryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.batchCreateTimelineEntries(id, dto, user);
  }

  // --- Timeline Diary Entries (Phase JW-G) ---

  @Get(':id/timeline-entries')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List project timeline diary entries' })
  findTimelineEntries(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findTimelineEntries(id);
  }

  @Post(':id/timeline-entries')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create timeline diary entry (Admin/Staff)' })
  createTimelineEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTimelineEntryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createTimelineEntry(id, dto, user.sub, user);
  }

  @Patch(':id/timeline-entries/:entryId')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'Update timeline diary entry (Admin/Staff)' })
  updateTimelineEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: UpdateTimelineEntryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateTimelineEntry(id, entryId, dto, user.sub, user);
  }

  @Delete(':id/timeline-entries/:entryId')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete timeline diary entry (Admin only)' })
  removeTimelineEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeTimelineEntry(id, entryId, user.sub, user);
  }

  // --- MOV Evidence Entries (Phase KO) ---

  @Get(':id/mov-entries')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({
    summary: 'List MOV evidence entries (optionally filter by related entity)',
  })
  listMovEntries(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('relatedEntityType')
    relatedEntityType?: 'MILESTONE' | 'TIMELINE_ENTRY',
    @Query('relatedEntityId') relatedEntityId?: string,
  ) {
    return this.service.listMovEntries(id, relatedEntityType, relatedEntityId);
  }

  @Post(':id/mov-entries')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create MOV evidence entry (Admin/Staff)' })
  createMovEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMovEntryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createMovEntry(id, dto, user.sub, user);
  }

  @Delete(':id/mov-entries/:movEntryId')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete MOV evidence entry (Admin/Staff)' })
  deleteMovEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('movEntryId', ParseUUIDPipe) movEntryId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.deleteMovEntry(id, movEntryId, user.sub, user);
  }

  // LC-C: Upload a file as MOV evidence for an existing entry
  @Post(':id/mov-entries/:movEntryId/upload-file')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Upload file evidence to a MOV entry (≤15 MB)' })
  uploadMovFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('movEntryId', ParseUUIDPipe) movEntryId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.uploadMovFile(id, movEntryId, file, user.sub);
  }

  // --- POW routes REMOVED (Phase ME, 2026-05-21) ---

  // --- Document Governance / Checklist — sub-resource routes only (KB-E) ---
  // NOTE: Static `document-types` route was relocated above the `:id` route
  // (see controller top) to avoid NestJS route-order collision with ParseUUIDPipe.

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

  // --- KD-E: Project Diary ---

  @Get(':id/diary-entries')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List project diary entries (newest first)' })
  findDiaryEntries(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findDiaryEntries(id);
  }

  @Post(':id/diary-entries')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a project diary entry' })
  createDiaryEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDiaryEntryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createDiaryEntry(id, dto, user);
  }

  @Patch(':id/diary-entries/:entryId')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'Update a project diary entry' })
  updateDiaryEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: UpdateDiaryEntryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateDiaryEntry(id, entryId, dto, user);
  }

  @Delete(':id/diary-entries/:entryId')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project diary entry' })
  removeDiaryEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeDiaryEntry(id, entryId, user);
  }

  // NI (2026-05-21): /financials routes REMOVED — superseded by /progress-reports.

  // --- Revision Orders (Phase ND) ---

  @Get(':id/revision-orders')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List revision orders for the project' })
  findRevisionOrders(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findRevisionOrders(id);
  }

  @Post(':id/revision-orders')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create revision order (auto-incremented number)' })
  createRevisionOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRevisionOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createRevisionOrder(id, dto, user);
  }

  @Patch(':id/revision-orders/:roId')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'Update revision order' })
  updateRevisionOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roId', ParseUUIDPipe) roId: string,
    @Body() dto: UpdateRevisionOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateRevisionOrder(id, roId, dto, user);
  }

  @Delete(':id/revision-orders/:roId')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete revision order' })
  removeRevisionOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roId', ParseUUIDPipe) roId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeRevisionOrder(id, roId, user);
  }

  // --- Progress Reports (Phase NE) ---

  @Get(':id/progress-reports')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List progress reports for the project' })
  findProgressReports(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findProgressReports(id);
  }

  @Post(':id/progress-reports')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create monthly/quarterly progress report' })
  createProgressReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProgressReportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createProgressReport(id, dto, user);
  }

  @Patch(':id/progress-reports/:reportId')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'Update progress report' })
  updateProgressReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() dto: UpdateProgressReportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateProgressReport(id, reportId, dto, user);
  }

  @Delete(':id/progress-reports/:reportId')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete progress report' })
  removeProgressReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeProgressReport(id, reportId, user);
  }

  // --- Gallery ---

  @Get(':id/gallery')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List project gallery items' })
  findGallery(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryGalleryDto,
  ) {
    return this.service.findGallery(id, query);
  }

  @Get(':id/gallery/:galleryId')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'Get gallery item details' })
  findGalleryItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('galleryId', ParseUUIDPipe) galleryId: string,
  ) {
    return this.service.findGalleryItem(id, galleryId);
  }

  @Post(':id/gallery')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  @ApiOperation({ summary: 'Upload gallery item (Admin/Staff)' })
  createGalleryItem(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateGalleryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createGalleryItem(id, file, dto, user.sub, user);
  }

  @Patch(':id/gallery/:galleryId')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'Update gallery item (Admin/Staff)' })
  updateGalleryItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('galleryId', ParseUUIDPipe) galleryId: string,
    @Body() dto: Partial<CreateGalleryDto>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateGalleryItem(id, galleryId, dto, user.sub);
  }

  @Delete(':id/gallery/:galleryId')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete gallery item (Admin only)' })
  removeGalleryItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('galleryId', ParseUUIDPipe) galleryId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeGalleryItem(id, galleryId, user.sub, user);
  }

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
  ) {
    return this.service.addDocumentToProject(id, file, dto, user.sub, user);
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
