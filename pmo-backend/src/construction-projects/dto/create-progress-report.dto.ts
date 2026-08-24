import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsNumber,
  IsInt,
  IsUUID,
  IsArray,
} from 'class-validator';

export class CreateProgressReportDto {
  @IsString()
  @IsNotEmpty()
  report_type!: string; // 'MONTHLY' | 'QUARTERLY' | 'AD_HOC' | 'WEEKLY'

  @IsDateString()
  report_date!: string;

  @IsOptional()
  @IsString()
  report_number?: string;

  @IsOptional()
  @IsNumber()
  percentage_completion?: number;

  @IsOptional()
  @IsNumber()
  planned_accomplishment?: number;

  @IsOptional()
  @IsNumber()
  slippage?: number;

  @IsOptional()
  @IsNumber()
  cost_incurred_to_date?: number;

  @IsOptional()
  @IsNumber()
  cost_incurred_this_period?: number;

  @IsOptional()
  @IsInt()
  calendar_days_elapsed?: number;

  @IsOptional()
  @IsNumber()
  percent_time_elapsed?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  issues_encountered?: string;

  @IsOptional()
  @IsString()
  mitigation_actions?: string;

  @IsOptional()
  @IsUUID()
  mov_document_id?: string;

  @IsOptional()
  @IsString()
  mov_link?: string;

  @IsOptional()
  @IsArray()
  narrative_list?: Array<{
    text: string;
    author?: string;
    created_at?: string;
  }>;

  @IsOptional()
  @IsArray()
  remarks_list?: Array<{ text: string; author?: string; created_at?: string }>;

  @IsOptional()
  @IsArray()
  issues_encountered_list?: Array<{
    text: string;
    author?: string;
    created_at?: string;
  }>;

  @IsOptional()
  @IsArray()
  mitigation_actions_list?: Array<{
    text: string;
    author?: string;
    created_at?: string;
  }>;
}
