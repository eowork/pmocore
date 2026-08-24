import {
  Controller,
  Get,
  Post,
  Patch,
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
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AccessRequestsService } from './access-requests.service';
import { CreateAccessRequestDto, DecideAccessRequestDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser } from '../auth/decorators';
import { JwtPayload } from '../common/interfaces';

/**
 * PHASE BBBA (BBBA-3c) — self-service access requests.
 * Create/own-list are open to any authenticated user; the queue + decision are Admin-only.
 */
@ApiTags('Access Requests')
@ApiBearerAuth('JWT-auth')
@Controller('access-requests')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
export class AccessRequestsController {
  constructor(private readonly service: AccessRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Request access to a module (any authenticated user)',
  })
  @ApiResponse({
    status: 201,
    description: 'Request submitted — pending administrator approval',
  })
  @ApiResponse({
    status: 409,
    description: 'A pending request already exists for this module',
  })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAccessRequestDto) {
    return this.service.create(user.sub, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: "List the caller's own access requests" })
  mine(@CurrentUser() user: JwtPayload) {
    return this.service.mine(user.sub);
  }

  @Get('pending-count')
  @Roles('Admin')
  @ApiOperation({
    summary: 'Count of pending access requests (Admin) — for the nav badge',
  })
  pendingCount() {
    return this.service.countPending();
  }

  @Get()
  @Roles('Admin')
  @ApiOperation({
    summary: 'List access requests with status/search/date filters (Admin)',
  })
  list(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // Default (no filters) preserves the prior behaviour: pending queue.
    if (!status && !q && !from && !to) {
      return this.service.listPending();
    }
    return this.service.list({ status, q, from, to });
  }

  // PHASE BBBF (Track 4): bulk approve/deny. Declared before :id routes for clarity.
  @Patch('bulk-decide')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk approve/deny access requests (Admin)' })
  bulkDecide(
    @Body()
    body: {
      ids: string[];
      decision: 'APPROVE' | 'DENY';
      granted_level?: string;
      decision_note?: string;
    },
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.service.bulkDecide(body.ids || [], body, admin);
  }

  @Patch('bulk-archive')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk archive decided access requests (Admin)' })
  bulkArchive(
    @Body() body: { ids: string[] },
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.service.bulkArchive(body.ids || [], admin);
  }

  @Patch(':id/decide')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve or deny an access request (Admin)',
    description:
      'APPROVE lifts the default-DENY module block (writes a permission override). The granted level is advisory — CRUD follows the user role until per-action permissions ship.',
  })
  @ApiResponse({ status: 200, description: 'Decision recorded' })
  @ApiResponse({ status: 400, description: 'Request already decided' })
  @ApiResponse({
    status: 403,
    description: 'Cannot grant to a user with equal/higher authority',
  })
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideAccessRequestDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.service.decide(id, dto, admin);
  }

  // PHASE BBBG (Track 2): lifecycle actions — revoke / reopen / expire (Admin); cancel (owner).
  @Patch(':id/revoke')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke an approved request (Admin)',
    description:
      'Removes the granted module override and marks the request REVOKED (history retained).',
  })
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { decision_note?: string },
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.service.revoke(id, admin, body?.decision_note);
  }

  @Patch(':id/reopen')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reopen a denied/revoked/expired request back to PENDING (Admin)',
  })
  reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.service.reopen(id, admin);
  }

  @Patch(':id/expire')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually expire a stale pending request (Admin)' })
  expire(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.service.expire(id, admin);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel your own pending request (owner)' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.cancel(id, user.sub);
  }
}
