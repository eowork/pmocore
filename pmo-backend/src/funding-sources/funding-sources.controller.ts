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
import { FundingSourcesService } from './funding-sources.service';
import {
  CreateFundingSourceDto,
  UpdateFundingSourceDto,
  QueryFundingSourceDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser } from '../auth/decorators';
import { JwtPayload } from '../common/interfaces';

@ApiTags('Reference: Funding Sources')
@ApiBearerAuth('JWT-auth')
@Controller('funding-sources')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FundingSourcesController {
  constructor(private readonly service: FundingSourcesService) {}

  // --- Read Operations: open to any authenticated user (visibility layer) ---
  // FIX: was @Roles('Admin','Staff','Viewer'), which 403'd any user outside that
  // exact list (e.g. a Contractor-role user, or any other role) even when they hold
  // a valid record_assignments.permissions.canEdit grant on a COI project and simply
  // need this reference data to populate the edit form's dropdowns. Reads are
  // harmless — matches the same pattern already used throughout
  // construction-projects.controller.ts.

  @Get()
  @Roles()
  @ApiOperation({ summary: 'List all funding sources' })
  findAll(@Query() query: QueryFundingSourceDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles()
  @ApiOperation({ summary: 'Get funding source details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  // --- Write Operations: Admin only ---

  @Post()
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create funding source (Admin only)' })
  create(@Body() dto: CreateFundingSourceDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles('Admin')
  @ApiOperation({ summary: 'Update funding source (Admin only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFundingSourceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete funding source (Admin only)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.remove(id, user.sub);
  }
}
