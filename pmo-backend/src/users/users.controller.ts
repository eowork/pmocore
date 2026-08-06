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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  QueryUserDto,
  AssignRoleDto,
  SetPermissionOverrideDto,
  BulkPermissionUpdateDto,
  BulkCrossUserAccessDto,
  AssignModuleDto,
  BulkModuleAssignmentDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser } from '../auth/decorators';
import { JwtPayload } from '../common/interfaces';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  // --- Read Operations: Admin can view (SuperAdmin bypasses via guard) ---

  @Get()
  @Roles('Admin')
  @ApiOperation({ summary: 'List all users (Admin/SuperAdmin only)' })
  findAll(@Query() query: QueryUserDto) {
    return this.service.findAll(query);
  }

  @Get('roles')
  @Roles('Admin')
  @ApiOperation({ summary: 'Get available roles (Admin/SuperAdmin only)' })
  getRoles() {
    return this.service.getRoles();
  }

  @Get('eligible-for-assignment')
  @Roles('Admin', 'Staff')
  @ApiOperation({
    summary:
      'List users eligible for record delegation (Admin/Staff) — Phase AV: Global, no campus filter',
  })
  findEligibleForAssignment() {
    return this.service.findEligibleForAssignment();
  }

  @Get('eligible-contractors')
  @Roles('Admin', 'Staff')
  @ApiOperation({
    summary:
      'List users with Contractor role — for Quick Assign Existing Contractor feature',
  })
  findEligibleContractors() {
    return this.service.findEligibleContractors();
  }

  // Phase HQ: Password reset requests (must be before :id to avoid UUID parse)
  @Get('password-reset-requests')
  @Roles('Admin')
  @ApiOperation({
    summary: 'Get password reset requests (Admin only)',
    description:
      'No status → pending queue (legacy default). status=COMPLETED or ALL surfaces history (PHASE BBBG Track 3).',
  })
  getPasswordResetRequests(@Query('status') status?: string) {
    return this.service.getPasswordResetRequests(status);
  }

  @Patch('password-reset-requests/:requestId/complete')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark password reset request as completed (Admin only)',
  })
  completePasswordResetRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.completePasswordResetRequest(requestId, actor);
  }

  // PHASE BBCH (Track 5): deny a pending reset request (preserves history, audits the decision).
  @Patch('password-reset-requests/:requestId/deny')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deny a pending password reset request (Admin only)',
  })
  denyPasswordResetRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() actor: JwtPayload,
    @Body('notes') notes?: string,
  ) {
    return this.service.denyPasswordResetRequest(requestId, actor, notes);
  }

  // PHASE BBBA (BBBA-1f): identity-unification duplicate-candidate REPORT (read-only).
  // Must be before :id to avoid UUID parse. No merge action — review only (R-294).
  @Get('duplicate-candidates')
  @Roles('Admin')
  @ApiOperation({
    summary: 'List duplicate identity candidates (Admin only, read-only)',
    description:
      'Heuristic report of likely same-person accounts (shared email, or username matching another account’s email). Read-only — merging is a deferred manual action.',
  })
  getDuplicateCandidates() {
    return this.service.getDuplicateCandidates();
  }

  // Phase HV: Cross-user bulk access update (Directive 225)
  @Post('bulk-access-update')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk update access for multiple users (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Bulk access update completed' })
  bulkCrossUserAccessUpdate(
    @Body() dto: BulkCrossUserAccessDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.bulkCrossUserAccessUpdate(dto, actor.sub);
  }

  @Get(':id')
  @Roles('Admin')
  @ApiOperation({ summary: 'Get user details (Admin/SuperAdmin only)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  // --- Write Operations: SuperAdmin only (enforced via guard bypass) ---
  // Note: @Roles() with no matching role means only SuperAdmin can access

  @Post()
  @Roles()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create user (SuperAdmin only)' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles()
  @ApiOperation({ summary: 'Update user (SuperAdmin only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Roles()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user (SuperAdmin only)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.remove(id, user.sub);
  }

  // --- Role Management: SuperAdmin only ---

  @Post(':id/roles')
  @Roles()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign role to user (SuperAdmin only)' })
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.assignRole(id, dto, user.sub);
  }

  @Delete(':id/roles/:roleId')
  @Roles()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove role from user (SuperAdmin only)' })
  removeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeRole(id, roleId, user.sub);
  }

  // --- PQ-D: Registration Approval ---

  @Post(':id/activate')
  @Roles('SuperAdmin', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate a pending self-registered user (Admin only)',
  })
  async activateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.service.activateUser(id, user.sub);
    return { message: 'User activated successfully' };
  }

  @Post(':id/reject-registration')
  @Roles('SuperAdmin', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a pending self-registered user (Admin only)',
  })
  async rejectRegistration(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.service.rejectRegistration(id, user.sub);
    return { message: 'Registration rejected' };
  }

  // --- Account Management: SuperAdmin only ---

  @Post(':id/unlock')
  @Roles()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlock user account (SuperAdmin only)' })
  unlockAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.unlockAccount(id, user.sub);
  }

  @Post(':id/reset-password')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Reset user password (Admin/SuperAdmin, bypasses complexity for lower-rank users)',
  })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('password') password: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.resetPassword(id, password, user.sub);
  }

  // --- Permission Overrides: Admin can manage (SuperAdmin bypasses) ---

  @Get(':id/permissions')
  @Roles('Admin')
  @ApiOperation({
    summary: 'Get user permission overrides (Admin/SuperAdmin only)',
  })
  getPermissionOverrides(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getPermissionOverrides(id);
  }

  @Post(':id/permissions')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set permission override (Admin/SuperAdmin only)' })
  setPermissionOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPermissionOverrideDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.setPermissionOverride(id, dto, user.sub);
  }

  @Post(':id/permissions/bulk')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk update permission overrides (Admin/SuperAdmin only)',
  })
  @ApiResponse({ status: 200, description: 'Permissions updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  bulkUpdatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkPermissionUpdateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.bulkUpdatePermissions(id, dto, user.sub);
  }

  @Delete(':id/permissions/:moduleKey')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove permission override (Admin/SuperAdmin only)',
  })
  removePermissionOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleKey') moduleKey: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removePermissionOverride(id, moduleKey, user.sub);
  }

  // --- Module Assignments: Admin can manage (SuperAdmin bypasses) ---

  @Get(':id/modules')
  @Roles('Admin')
  @ApiOperation({
    summary: 'Get user module assignments (Admin/SuperAdmin only)',
  })
  getModuleAssignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getModuleAssignments(id);
  }

  @Post(':id/modules')
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign module to user (Admin/SuperAdmin only)' })
  assignModule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignModuleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.assignModule(id, dto.module, user.sub);
  }

  @Post(':id/modules/bulk')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk update module assignments (Admin/SuperAdmin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Module assignments updated successfully',
  })
  bulkUpdateModuleAssignments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkModuleAssignmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.bulkUpdateModuleAssignments(id, dto.modules, user.sub);
  }

  @Delete(':id/modules/:module')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove module assignment (Admin/SuperAdmin only)' })
  removeModuleAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('module') module: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeModuleAssignment(id, module, user.sub);
  }

  // --- Pillar Assignments: Admin can manage (Phase HN, Directive 160) ---

  @Get(':id/pillar-assignments')
  @Roles('Admin')
  @ApiOperation({ summary: 'Get pillar assignments for user (Admin only)' })
  getPillarAssignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getPillarAssignments(id);
  }

  @Post(':id/pillar-assignments')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign pillar access to user (Admin only)' })
  assignPillar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('pillar_type') pillarType: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.assignPillar(id, pillarType, actor.sub);
  }

  @Delete(':id/pillar-assignments/:pillarType')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke pillar access from user (Admin only)' })
  revokePillar(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pillarType') pillarType: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.revokePillar(id, pillarType, actor.sub);
  }
}
