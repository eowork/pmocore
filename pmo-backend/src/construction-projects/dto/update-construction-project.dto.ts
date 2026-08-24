import { PartialType } from '@nestjs/mapped-types';
import { CreateConstructionProjectDto } from './create-construction-project.dto';
import {
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsUUID,
  IsString,
} from 'class-validator';

export class UpdateConstructionProjectDto extends PartialType(
  CreateConstructionProjectDto,
) {
  // KR-D2: Override project_code to remove the inherited @Matches() regex from CreateDto.
  // Format validation governs at CREATE only; PATCH accepts any string to prevent
  // validation failures when the frontend re-sends an unchanged stored code.
  @IsOptional()
  @IsString()
  project_code?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  physical_progress?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  financial_progress?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  target_physical_progress?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  target_financial_progress?: number;

  // Phase AF: Record-level delegation
  @IsOptional()
  @IsUUID()
  assigned_to?: string;
}
