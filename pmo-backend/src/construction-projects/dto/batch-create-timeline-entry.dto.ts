import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { CreateTimelineEntryDto } from './create-timeline-entry.dto';

export class BatchCreateTimelineEntryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateTimelineEntryDto)
  items!: CreateTimelineEntryDto[];
}
