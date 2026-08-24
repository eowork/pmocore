import { PartialType } from '@nestjs/mapped-types';
import { CreateProgressReportDto } from './create-progress-report.dto';

export class UpdateProgressReportDto extends PartialType(
  CreateProgressReportDto,
) {}
