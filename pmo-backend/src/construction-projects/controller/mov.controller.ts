import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { MovService } from '../service/mov.service';
import { CreateMovEntryDto } from '../dto';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Construction Projects MOV')
@ApiBearerAuth('JWT-auth')
@Controller('construction-projects')
// PHASE BBBA (BBBA-1c): default-DENY module access. Public surface lives in the
// separate PublicConstructionController, so gating the whole class is safe.
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@RequireModule('coi')
export class MovController {
  constructor(private readonly service: MovService) {}

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
    // Same optional SSE channel id as the document and gallery uploads.
    @Headers('x-upload-id') uploadId?: string,
  ) {
    return this.service.uploadMovFile(
      id,
      movEntryId,
      file,
      user.sub,
      uploadId,
      user,
    );
  }
}
