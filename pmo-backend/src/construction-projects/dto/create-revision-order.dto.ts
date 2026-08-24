import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsNumber,
  IsUUID,
} from 'class-validator';

export class CreateRevisionOrderDto {
  @IsString()
  @IsNotEmpty()
  revision_type!: string;

  @IsDateString()
  revision_date!: string;

  @IsOptional()
  @IsDateString()
  new_start_date?: string;

  @IsOptional()
  @IsDateString()
  new_completion_date?: string;

  @IsOptional()
  @IsString()
  new_duration?: string;

  @IsOptional()
  @IsNumber()
  cost_adjustment?: number;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsOptional()
  @IsString()
  approval_status?: string;

  @IsOptional()
  @IsUUID()
  mov_document_id?: string;

  @IsOptional()
  @IsString()
  mov_link?: string;
}
