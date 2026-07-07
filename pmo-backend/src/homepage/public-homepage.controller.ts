import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HomepageService } from './homepage.service';
import { Public } from '../auth/decorators';

// T-HOME-CMS (THC-4): anonymous homepage content — one aggregate call for all
// CMS-managed sections (mirrors public-construction.controller.ts beside the
// authenticated construction-projects controller).
@ApiTags('Public — Homepage')
@Controller('public/homepage')
export class PublicHomepageController {
  constructor(private readonly service: HomepageService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary:
      'Get all published homepage content — settings + visible items grouped by section (public, no auth)',
  })
  getContent(@Query('page_key') pageKey?: string) {
    return this.service.getPublicContent(pageKey || 'home');
  }
}
