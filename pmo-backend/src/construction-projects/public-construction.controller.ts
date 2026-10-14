import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConstructionProjectsService } from './construction-projects.service';
import { GalleryService } from './service/gallery.service';
import { QueryConstructionProjectDto, QueryGalleryDto } from './dto';
import { Public } from '../auth/decorators';

@ApiTags('Public — Construction Projects')
@Controller('public/construction-projects')
export class PublicConstructionController {
  constructor(
    private readonly service: ConstructionProjectsService,
    private readonly galleryService: GalleryService,
  ) {}

  // UUU-C: Dynamic template manifest. Declared BEFORE the ':id' routes so the
  // static two-segment path is matched without colliding with the UUID param route.
  @Public()
  @Get('document-templates/manifest')
  @ApiOperation({
    summary:
      'Discover available document templates by scanning the templates directory (public, no auth)',
  })
  getTemplateManifest() {
    return this.service.getTemplateManifest();
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List published infrastructure projects (public, no auth)',
  })
  findAll(@Query() query: QueryConstructionProjectDto) {
    const safeQuery = {
      ...query,
      publication_status: 'PUBLISHED',
    } as QueryConstructionProjectDto;
    return this.service.findAll(safeQuery, undefined);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get published project details (public, no auth)',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findPublicOne(id);
  }

  @Public()
  @Get(':id/gallery')
  @ApiOperation({
    summary: 'Get gallery for published project (public, no auth)',
  })
  async findGallery(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryGalleryDto,
  ) {
    await this.service.findPublicOne(id);
    return this.galleryService.findGallery(id, query);
  }

  // POW public route REMOVED (Phase ME, 2026-05-21)
}
