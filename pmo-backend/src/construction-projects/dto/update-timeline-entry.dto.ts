import { PartialType } from '@nestjs/mapped-types';
import { CreateTimelineEntryDto } from './create-timeline-entry.dto';

export class UpdateTimelineEntryDto extends PartialType(
  CreateTimelineEntryDto,
) {}
