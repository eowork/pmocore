import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UniversityOperationsController } from './university-operations.controller';
import { UniversityOperationsService } from './university-operations.service';
import {
  UniversityOperation,
  OperationIndicator,
  OperationFinancial,
  QuarterlyReport,
  QuarterlyReportSubmission,
  FiscalYear,
  PillarIndicatorTaxonomy,
  OperationOrganizationalInfo,
  RecordAssignment,
  UserModuleAssignment,
  UserPermissionOverride,
} from '../database/entities';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      UniversityOperation,
      OperationIndicator,
      OperationFinancial,
      QuarterlyReport,
      QuarterlyReportSubmission,
      FiscalYear,
      PillarIndicatorTaxonomy,
      OperationOrganizationalInfo,
      RecordAssignment,
      UserModuleAssignment,
      UserPermissionOverride,
    ]),
  ],
  controllers: [UniversityOperationsController],
  providers: [UniversityOperationsService],
  exports: [UniversityOperationsService],
})
export class UniversityOperationsModule {}
