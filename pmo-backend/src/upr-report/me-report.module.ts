import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MeReportService } from './me-report.service';
import { MeReportController } from './me-report.controller';
import {
  UprBestPractices,
  UprChallengesOpportunities,
  UprFutureGoal,
  UprInitiative,
  UPRReport,
} from '../database/entities';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      UPRReport,
      UprInitiative,
      UprBestPractices,
      UprChallengesOpportunities,
      UprFutureGoal,
    ]),
  ],
  providers: [MeReportService],
  controllers: [MeReportController],
})
export class MeReportModule {}
