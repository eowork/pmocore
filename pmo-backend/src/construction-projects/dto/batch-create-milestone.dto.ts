import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { CreateMilestoneDto } from './create-milestone.dto';

export class BatchCreateMilestoneDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateMilestoneDto)
  items!: CreateMilestoneDto[];
}
