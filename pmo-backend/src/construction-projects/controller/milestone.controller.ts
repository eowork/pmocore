import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  ModuleAccessGuard,
  RequireModule,
  Roles,
  RolesGuard,
} from '../../auth';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MilestoneService } from '../service/milestone.service';
import { BatchCreateMilestoneDto, CreateMilestoneDto } from '../dto';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Construction Projects Milestones')
@ApiBearerAuth('JWT-auth')
@Controller('construction-projects')
// PHASE BBBA (BBBA-1c): default-DENY module access. Public surface lives in the
// separate PublicConstructionController, so gating the whole class is safe.
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@RequireModule('coi')
export class MilestoneController {
  constructor(private readonly service: MilestoneService) {}

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
}
