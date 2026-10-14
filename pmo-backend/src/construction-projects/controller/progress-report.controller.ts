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
import { ProgressReportService } from '../service/progress-report.service';
import { CreateProgressReportDto, UpdateProgressReportDto } from '../dto';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Construction Projects Progress Report')
@ApiBearerAuth('JWT-auth')
@Controller('construction-projects')
// PHASE BBBA (BBBA-1c): default-DENY module access. Public surface lives in the
// separate PublicConstructionController, so gating the whole class is safe.
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@RequireModule('coi')
export class ProgressReportController {
  constructor(private readonly service: ProgressReportService) {}

  @Get(':id/progress-reports')
  @Roles() // PHASE BBBE (Track 1): read open to any authenticated user (visibility layer)
  @ApiOperation({ summary: 'List progress reports for the project' })
  findProgressReports(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findProgressReports(id);
  }

  @Post(':id/progress-reports')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create monthly/quarterly progress report' })
  createProgressReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProgressReportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createProgressReport(id, dto, user);
  }

  @Patch(':id/progress-reports/:reportId')
  @Roles('Admin', 'Staff')
  @ApiOperation({ summary: 'Update progress report' })
  updateProgressReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() dto: UpdateProgressReportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateProgressReport(id, reportId, dto, user);
  }

  @Delete(':id/progress-reports/:reportId')
  @Roles('Admin', 'Staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete progress report' })
  removeProgressReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeProgressReport(id, reportId, user);
  }
}
