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
import { HomepageService } from './homepage.service';
import {
  UpdateHomepageSettingDto,
  CreateHomepageItemDto,
  UpdateHomepageItemDto,
  ReorderHomepageItemsDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';
import { JwtPayload } from '../common/interfaces';
import { HomepageAccessGuard } from './homepage-access.guard';

// T-HOME-CMS (THC-3): admin CRUD for homepage content.
// T-HOME-CMS-6 (TH6-5): tightened from any-Admin (@Roles('Admin')) to
// SuperAdmin or an explicit 'homepage' module override — see HomepageAccessGuard.
@ApiTags('Homepage Management')
@ApiBearerAuth('JWT-auth')
@Controller('homepage')
@UseGuards(JwtAuthGuard, HomepageAccessGuard)
export class HomepageController {
  constructor(private readonly service: HomepageService) {}

  @Get('settings')
  @ApiOperation({ summary: 'List all homepage settings (admin)' })
  findAllSettings(@Query('page_key') pageKey?: string) {
    return this.service.findAllSettings(pageKey || 'home');
  }

  @Patch('settings/:key')
  @ApiOperation({ summary: 'Update a homepage setting value (admin)' })
  updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateHomepageSettingDto,
    @CurrentUser() user: JwtPayload,
    @Query('page_key') pageKey?: string,
  ) {
    return this.service.updateSetting(key, dto, user.sub, pageKey || 'home');
  }

  @Get('items')
  @ApiOperation({
    summary: 'List homepage items, optionally by section (admin)',
  })
  findAllItems(
    @Query('section_key') sectionKey?: string,
    @Query('page_key') pageKey?: string,
  ) {
    return this.service.findAllItems(sectionKey, pageKey || 'home');
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a homepage item (admin)' })
  createItem(
    @Body() dto: CreateHomepageItemDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createItem(dto, user.sub);
  }

  // Declared before ':id' PATCH so the static segment wins route matching.
  @Patch('items/reorder')
  @ApiOperation({ summary: 'Batch-update item ordering (admin)' })
  reorderItems(
    @Body() dto: ReorderHomepageItemsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.reorderItems(dto, user.sub);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update a homepage item (admin)' })
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHomepageItemDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateItem(id, dto, user.sub);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a homepage item (admin)' })
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeItem(id, user.sub);
  }
}
