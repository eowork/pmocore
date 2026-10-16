import { Module } from '@nestjs/common';
import { MeReportService } from './me-report.service';
import { MeReportController } from './me-report.controller';

@Module({
  providers: [MeReportService],
  controllers: [MeReportController],
})
export class MeReportModule {}
