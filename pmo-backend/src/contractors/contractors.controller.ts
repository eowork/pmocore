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
import { ContractorsService } from './contractors.service';
import {
  CreateContractorDto,
  UpdateContractorDto,
  QueryContractorDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser } from '../auth/decorators';
import { JwtPayload } from '../common/interfaces';
import { ContractorStatus } from '../common/enums';

@ApiTags('Reference: Contractors')
@ApiBearerAuth('JWT-auth')
@Controller('contractors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractorsController {
  constructor(private readonly service: ContractorsService) {}

  // --- Read Operations: open to any authenticated user (visibility layer) ---
  // FIX: was @Roles('Admin','Staff','Viewer'), which 403'd any user outside that
  // exact list even when they hold a valid record_assignments.permissions.canEdit
  // grant on a COI project and simply need this reference data to populate the edit
  // form's dropdowns. Reads are harmless — matches the pattern already used
  // throughout construction-projects.controller.ts.

  @Get()
  @Roles()
  @ApiOperation({ summary: 'List all contractors' })
  findAll(@Query() query: QueryContractorDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles()
  @ApiOperation({ summary: 'Get contractor details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  // --- Write Operations: Admin only ---

  @Post()
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create contractor (Admin only)' })
  create(@Body() dto: CreateContractorDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles('Admin')
  @ApiOperation({ summary: 'Update contractor (Admin only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete contractor (Admin only)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.remove(id, user.sub);
  }

  @Patch(':id/status')
  @Roles('Admin')
  @ApiOperation({ summary: 'Update contractor status (Admin only)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: ContractorStatus,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateStatus(id, status, user.sub);
  }
}
