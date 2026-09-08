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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RepairProjectsService } from './repair-projects.service';
import {
  CreateRepairProjectDto,
  UpdateRepairProjectDto,
  QueryRepairProjectDto,
  CreatePowItemDto,
  CreatePhaseDto,
  CreateTeamMemberDto,
} from './dto';
import { JwtAuthGuard, RolesGuard, ModuleAccessGuard } from '../auth/guards';
import { Roles, CurrentUser, RequireModule } from '../auth/decorators';
import { JwtPayload } from '../common/interfaces';

@ApiTags('Repair Projects')
@ApiBearerAuth('JWT-auth')
@Controller('repair-projects')
// PHASE BBBA (BBBA-1c): default-DENY module access.
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@RequireModule('repairs')
export class RepairProjectsController {
  constructor(private readonly service: RepairProjectsService) {}

  // --- Read Operations: All authenticated roles can view ---

  @Get()
  @Roles('Admin', 'Staff', 'Viewer')
  @ApiOperation({
    summary: 'List all repair projects (non-Admin only see PUBLISHED)',
  })
  findAll(
    @Query() query: QueryRepairProjectDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(query, user);
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

  @Get(':id')
  @Roles('Admin', 'Staff', 'Viewer')
  @ApiOperation({ summary: 'Get repair project details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  // --- Create/Update Operations: Admin and Staff ---

  @Post()
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create repair project (Admin=PUBLISHED, Staff=DRAFT)',
  })
  create(@Body() dto: CreateRepairProjectDto, @CurrentUser() user: JwtPayload) {
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
    return this.service.submitForReview(id, user.sub);
  }

  // Phase BBCH (Track 1): role gate relaxed — authority is now Admin OR an
  // Approver/Manager 'repairs' module-level grant, enforced inside the service via
  // permissionResolver.canApproveModule().
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish (approve) a draft (Admin, or Approver/Manager module level)' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.publish(id, user.sub, user);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a draft with notes (Admin, or Approver/Manager module level)' })
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
    return this.service.withdraw(id, user.sub);
  }

  @Patch(':id')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'Update repair project (Admin/Staff)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRepairProjectDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub, user);
  }

  // --- Delete Operations: Admin only ---

  @Delete(':id')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete repair project (Admin only)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.remove(id, user.sub);
  }

  // --- POW Items ---

  @Get(':id/pow-items')
  @Roles('Admin', 'Staff', 'Viewer')
  @ApiOperation({ summary: 'List POW items' })
  findPowItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('category') category?: string,
    @Query('phase') phase?: string,
  ) {
    return this.service.findPowItems(id, category, phase);
  }

  @Post(':id/pow-items')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create POW item (Admin/Staff)' })
  createPowItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePowItemDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createPowItem(id, dto, user.sub);
  }

  @Patch(':id/pow-items/:itemId')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'Update POW item (Admin/Staff)' })
  updatePowItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: Partial<CreatePowItemDto>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updatePowItem(id, itemId, dto, user.sub);
  }

  @Delete(':id/pow-items/:itemId')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete POW item (Admin only)' })
  removePowItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removePowItem(id, itemId, user.sub);
  }

  // --- Phases ---

  @Get(':id/phases')
  @Roles('Admin', 'Staff', 'Viewer')
  @ApiOperation({ summary: 'List project phases' })
  findPhases(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findPhases(id);
  }

  @Post(':id/phases')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create phase (Admin/Staff)' })
  createPhase(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePhaseDto,
  ) {
    return this.service.createPhase(id, dto);
  }

  @Patch(':id/phases/:phaseId')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'Update phase (Admin/Staff)' })
  updatePhase(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('phaseId', ParseUUIDPipe) phaseId: string,
    @Body() dto: Partial<CreatePhaseDto>,
  ) {
    return this.service.updatePhase(id, phaseId, dto);
  }

  // --- Team Members ---

  @Get(':id/team-members')
  @Roles('Admin', 'Staff', 'Viewer')
  @ApiOperation({ summary: 'List team members' })
  findTeamMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findTeamMembers(id);
  }

  @Post(':id/team-members')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add team member (Admin/Staff)' })
  createTeamMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTeamMemberDto,
  ) {
    return this.service.createTeamMember(id, dto);
  }

  @Delete(':id/team-members/:memberId')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove team member (Admin only)' })
  removeTeamMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.service.removeTeamMember(id, memberId);
  }
}
