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
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UniversityOperationsService } from './university-operations.service';
import {
  CreateOperationDto,
  UpdateOperationDto,
  QueryOperationDto,
  CreateIndicatorDto,
  CreateIndicatorQuarterlyDto,
  CreateFinancialDto,
  FundType,
  QueryQuarterlyReportsDto,
} from './dto';
import { UpdateOrganizationalInfoDto } from './dto/update-organizational-info.dto';
import { JwtAuthGuard, RolesGuard, ModuleAccessGuard } from '../auth/guards';
import { Roles, CurrentUser, RequireModule } from '../auth/decorators';
import { JwtPayload } from '../common/interfaces';

@ApiTags('University Operations')
@ApiBearerAuth('JWT-auth')
@Controller('university-operations')
// PHASE BBBE (Track 1): ModuleAccessGuard is the read/write authority — reads open to any
// authenticated user (visibility), writes require override+level. The class-level
// @Roles('Admin','Staff') was REMOVED (it blocked dashboard-only users from reading analytics,
// R-342); method-level @Roles('Admin')/@Roles('SuperAdmin') on sensitive routes are retained.
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@RequireModule('university_operations')
export class UniversityOperationsController {
  constructor(private readonly service: UniversityOperationsService) {}

  @Get()
  findAll(@Query() query: QueryOperationDto, @CurrentUser() user: JwtPayload) {
    return this.service.findAll(query, user);
  }

  @Get('pending-review')
  @Roles('Admin')
  findPendingReview(@CurrentUser() user: JwtPayload) {
    return this.service.findPendingReview(user);
  }

  @Get('my-drafts')
  findMyDrafts(@CurrentUser() user: JwtPayload) {
    return this.service.findMyDrafts(user.sub);
  }

  /**
   * Phase CX-F: Diagnostic endpoint for checking orphan indicator migration status
   * Admin-only - returns counts of linked vs orphan indicators
   */
  @Get('diagnostics/orphan-indicators')
  @Roles('Admin')
  getOrphanIndicatorDiagnostics() {
    return this.service.getOrphanIndicatorDiagnostics();
  }

  /**
   * Phase DK-D: Get detailed list of orphaned indicators for admin review
   * Admin-only - returns full orphan records with quarterly data status
   */
  @Get('diagnostics/orphan-indicators/list')
  @Roles('Admin')
  getOrphanedIndicatorsList() {
    return this.service.getOrphanedIndicatorsList();
  }

  /**
   * Phase CX-B: Get fixed taxonomy by pillar type (not by operation ID)
   * Returns all indicators from pillar_indicator_taxonomy for the specified pillar
   */
  @Get('taxonomy/:pillarType')
  findTaxonomyByPillar(@Param('pillarType') pillarType: string) {
    return this.service.findTaxonomyByPillarType(pillarType);
  }

  /**
   * Phase CX-B: Get indicators by pillar type and fiscal year (cross-operation)
   * Phase DY-D: Optional quarter filter for per-quarter snapshots
   */
  @Get('indicators')
  findIndicatorsByPillar(
    @Query('pillar_type') pillarType: string,
    @Query('fiscal_year') fiscalYear: number,
    @Query('quarter') quarter?: string,
  ) {
    if (pillarType && fiscalYear) {
      return this.service.findIndicatorsByPillarAndYear(
        pillarType,
        fiscalYear,
        quarter,
      );
    }
    // Fallback: return empty if no pillar_type specified
    return [];
  }

  // ─── Phase DE: Analytics Endpoints ────────────────────────────────────────────

  /**
   * Phase DE-A: Get pillar summary analytics
   * Returns aggregated metrics for each pillar: indicator counts, accomplishment rates
   */
  @Get('analytics/pillar-summary')
  getPillarSummary(@Query('fiscal_year') fiscalYear: number) {
    return this.service.getPillarSummary(fiscalYear);
  }

  /**
   * Phase DE-A: Get quarterly trend data
   * Returns Q1-Q4 accomplishment trend for charting
   */
  @Get('analytics/quarterly-trend')
  getQuarterlyTrend(
    @Query('fiscal_year') fiscalYear: number,
    @Query('pillar_type') pillarType?: string,
  ) {
    return this.service.getQuarterlyTrend(fiscalYear, pillarType);
  }

  /**
   * Phase DE-A: Get year-over-year comparison
   * Returns comparison data across multiple fiscal years
   */
  @Get('analytics/yearly-comparison')
  getYearlyComparison(@Query('years') years: string) {
    // Parse comma-separated years (e.g., "2024,2025,2026")
    const yearList = years
      ? years
          .split(',')
          .map((y) => parseInt(y.trim(), 10))
          .filter((y) => !isNaN(y))
      : [];
    return this.service.getYearlyComparison(yearList);
  }

  // ─── Phase EZ-C: Financial Analytics Endpoints ──────────────────────────────

  @Get('analytics/financial-pillar-summary')
  getFinancialPillarSummary(@Query('fiscal_year') fiscalYear: number) {
    return this.service.getFinancialPillarSummary(fiscalYear);
  }

  @Get('analytics/financial-quarterly-trend')
  getFinancialQuarterlyTrend(
    @Query('fiscal_year') fiscalYear: number,
    @Query('pillar_type') pillarType?: string,
  ) {
    return this.service.getFinancialQuarterlyTrend(fiscalYear, pillarType);
  }

  @Get('analytics/financial-yearly-comparison')
  getFinancialYearlyComparison(@Query('years') years: string) {
    const yearList = years
      ? years
          .split(',')
          .map((y) => parseInt(y.trim(), 10))
          .filter((y) => !isNaN(y))
      : [];
    return this.service.getFinancialYearlyComparison(yearList);
  }

  @Get('analytics/financial-expense-breakdown')
  getFinancialExpenseBreakdown(@Query('fiscal_year') fiscalYear: number) {
    return this.service.getFinancialExpenseBreakdown(fiscalYear);
  }

  @Get('analytics/financial-campus-breakdown')
  getFinancialCampusBreakdown(@Query('fiscal_year') fiscalYear: number) {
    return this.service.getFinancialCampusBreakdown(fiscalYear);
  }

  // Phase GS-4: Financial Pillar × Expense Class Breakdown (Directive 314)
  @Get('analytics/financial-pillar-expense-breakdown')
  getFinancialPillarExpenseBreakdown(@Query('fiscal_year') fiscalYear: number) {
    return this.service.getFinancialPillarExpenseBreakdown(fiscalYear);
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase DP-A: Fiscal Year Configuration Endpoints
  // IMPORTANT: These MUST be defined BEFORE @Get(':id') to avoid route interception
  // ═══════════════════════════════════════════════════════════════

  @Get('config/fiscal-years')
  getActiveFiscalYears() {
    return this.service.getActiveFiscalYears();
  }

  // Phase DV-E: Allow Admin role to create fiscal years (in addition to SuperAdmin)
  @Post('config/fiscal-years')
  @Roles('SuperAdmin', 'Admin')
  @HttpCode(HttpStatus.CREATED)
  createFiscalYear(@Body() body: { year: number; label?: string }) {
    return this.service.createFiscalYear(body.year, body.label);
  }

  @Patch('config/fiscal-years/:year')
  @Roles('SuperAdmin')
  @HttpCode(HttpStatus.OK)
  toggleFiscalYear(
    @Param('year') year: number,
    @Body() body: { is_active: boolean },
  ) {
    return this.service.toggleFiscalYear(+year, body.is_active);
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase EQ-A: Quarterly Reports — MUST be before @Get(':id') to avoid route interception
  // ═══════════════════════════════════════════════════════════════

  @Post('quarterly-reports')
  @HttpCode(HttpStatus.CREATED)
  createQuarterlyReport(
    @Body('fiscal_year') fiscalYear: number,
    @Body('quarter') quarter: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createQuarterlyReport(fiscalYear, quarter, user.sub);
  }

  @Get('quarterly-reports')
  findQuarterlyReports(@Query() query: QueryQuarterlyReportsDto) {
    return this.service.findQuarterlyReports(query.fiscal_year, query.quarter);
  }

  @Get('quarterly-reports/pending-review')
  @Roles('Admin')
  findQuarterlyReportsPendingReview(@CurrentUser() user: JwtPayload) {
    return this.service.findQuarterlyReportsPendingReview(user);
  }

  @Get('quarterly-reports/pending-unlock')
  @Roles('Admin')
  findQuarterlyReportsPendingUnlock(@CurrentUser() user: JwtPayload) {
    return this.service.findQuarterlyReportsPendingUnlock(user);
  }

  @Get('quarterly-reports/reviewed')
  @Roles('Admin')
  findQuarterlyReportsReviewed(@CurrentUser() user: JwtPayload) {
    return this.service.findQuarterlyReportsReviewed(user);
  }

  @Get('quarterly-reports/submission-history')
  @Roles('Admin')
  findSubmissionHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryQuarterlyReportsDto,
  ) {
    return this.service.findSubmissionHistory(
      user,
      query.fiscal_year,
      query.quarter,
    );
  }

  @Get('quarterly-reports/:id/history')
  @Roles('Admin')
  getQuarterlyReportHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findQuarterlyReportHistory(id, user);
  }

  @Get('quarterly-reports/:id')
  findOneQuarterlyReport(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOneQuarterlyReport(id);
  }

  @Post('quarterly-reports/:id/submit')
  @HttpCode(HttpStatus.OK)
  submitQuarterlyReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.submitQuarterlyReport(id, user.sub);
  }

  @Post('quarterly-reports/:id/approve')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  approveQuarterlyReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.approveQuarterlyReport(id, user.sub, user);
  }

  @Post('quarterly-reports/:id/reject')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  rejectQuarterlyReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('notes') notes: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.rejectQuarterlyReport(id, user.sub, notes, user);
  }

  @Post('quarterly-reports/:id/withdraw')
  @HttpCode(HttpStatus.OK)
  withdrawQuarterlyReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.withdrawQuarterlyReport(id, user.sub);
  }

  // Phase GOV: Post-Publication Governance Endpoints

  @Post('quarterly-reports/:id/unlock')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  unlockQuarterlyReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.unlockQuarterlyReport(id, user.sub, reason, user);
  }

  @Post('quarterly-reports/:id/request-unlock')
  @HttpCode(HttpStatus.OK)
  requestQuarterlyReportUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.requestQuarterlyReportUnlock(id, user.sub, reason);
  }

  @Post('quarterly-reports/:id/deny-unlock')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  denyQuarterlyReportUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.denyQuarterlyReportUnlock(id, user.sub, user);
  }

  /**
   * Phase HU: Resolve operation context for Physical/Financial display pages.
   * Bypasses ownership filter — returns operation for any OPERATIONS module user.
   * Directives 209, 211
   */
  @Get('pillar-operation')
  async findPillarOperation(
    @Query('pillar_type') pillarType: string,
    @Query('fiscal_year') fiscalYear: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const op = await this.service.findOperationForDisplay(
      pillarType,
      parseInt(fiscalYear, 10),
      user,
    );
    if (!op) {
      throw new NotFoundException(
        `No operation found for pillar ${pillarType}, fiscal year ${fiscalYear}`,
      );
    }
    return op;
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findOne(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateOperationDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub, user);
  }

  // --- Draft Governance Workflow ---

  @Post(':id/submit-for-review')
  @HttpCode(HttpStatus.OK)
  submitForReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.submitForReview(id, user.sub);
  }

  @Post(':id/publish')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.publish(id, user.sub, user);
  }

  @Post(':id/reject')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('notes') notes: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.reject(id, user.sub, notes, user);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.withdraw(id, user.sub);
  }

  // ─── Phase DY-D: Per-Quarter Submission Workflow ───────────────────────────────

  @Post(':id/submit-quarter')
  @HttpCode(HttpStatus.OK)
  submitQuarter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('quarter') quarter: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.submitQuarterForReview(id, quarter, user.sub);
  }

  @Post(':id/approve-quarter')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  approveQuarter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('quarter') quarter: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.approveQuarter(id, quarter, user.sub, user);
  }

  @Post(':id/reject-quarter')
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  rejectQuarter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('quarter') quarter: string,
    @Body('notes') notes: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.rejectQuarter(id, quarter, user.sub, notes, user);
  }

  @Post(':id/withdraw-quarter')
  @HttpCode(HttpStatus.OK)
  withdrawQuarter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('quarter') quarter: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.withdrawQuarter(id, quarter, user.sub);
  }

  // ─── Phase IJ: Assignment CRUD ────────────────────────────────────────────────

  @Get(':id/assignments')
  getAssignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getOperationAssignments(id);
  }

  @Post(':id/assignments')
  @HttpCode(HttpStatus.CREATED)
  addAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('user_id') userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addOperationAssignment(id, userId, user.sub);
  }

  @Delete(':id/assignments/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.service.removeOperationAssignment(id, userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOperationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub, user);
  }

  @Delete(':id')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.remove(id, user.sub);
  }

  // --- Indicators ---

  /**
   * Phase CT: Fetch fixed indicator taxonomy for this operation's pillar type
   * Returns the 3 seeded indicators from pillar_indicator_taxonomy
   */
  @Get(':id/indicator-taxonomy')
  findIndicatorTaxonomy(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findIndicatorTaxonomy(id);
  }

  @Get(':id/indicators')
  findIndicators(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('fiscal_year') fiscalYear?: number,
  ) {
    return this.service.findIndicators(id, fiscalYear);
  }

  /**
   * Phase CT: Create quarterly indicator data linked to fixed taxonomy
   * Requires pillar_indicator_id from taxonomy (cannot create new indicators)
   */
  @Post(':id/indicators/quarterly')
  @HttpCode(HttpStatus.CREATED)
  createIndicatorQuarterlyData(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateIndicatorQuarterlyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createIndicatorQuarterlyData(id, dto, user.sub, user);
  }

  /**
   * Phase DJ-A: Update quarterly indicator data with full validation
   * Enforces fiscal_year scope and taxonomy validation
   */
  @Patch(':id/indicators/:indicatorId/quarterly')
  @HttpCode(HttpStatus.OK)
  updateIndicatorQuarterlyData(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('indicatorId', ParseUUIDPipe) indicatorId: string,
    @Body() dto: Partial<CreateIndicatorQuarterlyDto>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateIndicatorQuarterlyData(
      id,
      indicatorId,
      dto,
      user.sub,
      user,
    );
  }

  /**
   * DEPRECATED: Legacy indicator CRUD (will be removed after frontend refactor)
   * Use POST :id/indicators/quarterly instead
   */
  @Post(':id/indicators')
  @HttpCode(HttpStatus.CREATED)
  createIndicator(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateIndicatorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createIndicator(id, dto, user.sub, user);
  }

  @Patch(':id/indicators/:indicatorId')
  updateIndicator(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('indicatorId', ParseUUIDPipe) indicatorId: string,
    @Body() dto: Partial<CreateIndicatorDto>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateIndicator(id, indicatorId, dto, user.sub, user);
  }

  @Delete(':id/indicators/:indicatorId')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeIndicator(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('indicatorId', ParseUUIDPipe) indicatorId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeIndicator(id, indicatorId, user.sub, user);
  }

  // --- Financials ---
  // Phase BC: Added fund_type query param for BAR1 subcategory tab filtering
  // Phase ET-B: Added expense_class query param for PS/MOOE/CO filtering
  @Get(':id/financials')
  findFinancials(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('fiscal_year') fiscalYear?: number,
    @Query('quarter') quarter?: string,
    @Query('fund_type') fundType?: FundType,
    @Query('expense_class') expenseClass?: string,
  ) {
    return this.service.findFinancials(
      id,
      fiscalYear,
      quarter,
      fundType,
      expenseClass,
    );
  }

  // Phase CN: Financial CRUD with ownership + publication status validation
  @Post(':id/financials')
  @HttpCode(HttpStatus.CREATED)
  createFinancial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFinancialDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createFinancial(id, dto, user.sub, user);
  }

  @Patch(':id/financials/:financialId')
  updateFinancial(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('financialId', ParseUUIDPipe) financialId: string,
    @Body() dto: Partial<CreateFinancialDto>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateFinancial(id, financialId, dto, user.sub, user);
  }

  @Delete(':id/financials/:financialId')
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFinancial(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('financialId', ParseUUIDPipe) financialId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeFinancial(id, financialId, user.sub, user);
  }

  // --- Phase CH: Organizational Info ---

  @Get(':id/organizational-info')
  findOrganizationalInfo(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOrganizationalInfo(id);
  }

  @Patch(':id/organizational-info')
  @HttpCode(HttpStatus.OK)
  updateOrganizationalInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationalInfoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateOrganizationalInfo(id, dto, user.sub);
  }
}
