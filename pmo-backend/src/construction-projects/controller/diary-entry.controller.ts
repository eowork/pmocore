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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  JwtAuthGuard,
  ModuleAccessGuard,
  RequireModule,
  Roles,
  RolesGuard,
} from '../../auth';
import { DiaryEntryService } from '../service/diary-entry.service';
import { CreateDiaryEntryDto, UpdateDiaryEntryDto } from '../dto';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Construction Projects Diary Entries')
@ApiBearerAuth('JWT-auth')
@Controller('construction-projects')
// PHASE BBBA (BBBA-1c): default-DENY module access. Public surface lives in the
// separate PublicConstructionController, so gating the whole class is safe.
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@RequireModule('coi')
export class DiaryEntryController {
  constructor(private readonly service: DiaryEntryService) {}

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
}
