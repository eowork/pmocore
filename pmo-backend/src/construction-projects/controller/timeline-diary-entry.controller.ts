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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TimelineDiaryEntryService } from '../service/timeline-diary-entry.service';
import {
  BatchCreateTimelineEntryDto,
  CreateTimelineEntryDto,
  UpdateTimelineEntryDto,
} from '../dto';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Construction Projects Timeline Diary Entries')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@RequireModule('coi')
@Controller('construction-projects')
export class TimelineDiaryEntryController {
  constructor(private readonly service: TimelineDiaryEntryService) {}

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
}
