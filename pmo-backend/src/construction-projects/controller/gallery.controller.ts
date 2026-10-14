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
  Patch,
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
import { GalleryService } from '../service/gallery.service';
import { CreateGalleryDto, QueryGalleryDto } from '../dto';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Construction Projects Gallery')
@ApiBearerAuth('JWT-auth')
@Controller('construction-projects')
// PHASE BBBA (BBBA-1c): default-DENY module access. Public surface lives in the
// separate PublicConstructionController, so gating the whole class is safe.
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@RequireModule('coi')
export class GalleryController {
  constructor(private readonly service: GalleryService) {}

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
    // Same optional SSE channel id as the document upload; see uploadDocument.
    @Headers('x-upload-id') uploadId?: string,
  ) {
    return this.service.createGalleryItem(
      id,
      file,
      dto,
      user.sub,
      user,
      uploadId,
    );
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
    return this.service.updateGalleryItem(id, galleryId, dto, user.sub, user);
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
}
