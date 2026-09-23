import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsNumber,
  IsInt,
  IsUUID,
  IsArray,
  IsIn,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

/**
 * Column limits of construction_progress_reports, mirrored here so an out-of-range
 * value is rejected by validation with an actionable 400 instead of reaching Postgres
 * and surfacing as an opaque 500 ("numeric field overflow" / "value too long for type
 * character varying(20)").
 *
 * Keep these in sync with the entity and the migration:
 *   report_number             VARCHAR(20)
 *   percentage_completion     DECIMAL(5,2) NOT NULL
 *   planned_accomplishment    DECIMAL(5,2)
 *   slippage                  DECIMAL(5,2)
 *   percent_time_elapsed      DECIMAL(5,2)
 *   cost_incurred_to_date     DECIMAL(15,2)
 *   cost_incurred_this_period DECIMAL(15,2)
 *   calendar_days_elapsed     INTEGER
 */
export const REPORT_NUMBER_MAX_LENGTH = 20;
export const REPORT_TYPES = [
  'MONTHLY',
  'QUARTERLY',
  'AD_HOC',
  'WEEKLY',
] as const;
/** Work accomplished is a share of the contract: it cannot be negative or exceed 100 %. */
export const PERCENT_MIN = 0;
export const PERCENT_MAX = 100;
/** Slippage is planned minus actual, so it is signed but still bounded by the two percentages. */
export const SLIPPAGE_MIN = -100;
export const SLIPPAGE_MAX = 100;
/**
 * Elapsed time may pass 100 % on an overdue project, so it is capped at what
 * DECIMAL(5,2) can store rather than at 100.
 */
export const PERCENT_ELAPSED_MAX = 999.99;
/** Largest value DECIMAL(15,2) can hold. */
export const MONEY_MAX = 9999999999999.99;
/** Largest value a Postgres INTEGER can hold. */
export const INT32_MAX = 2147483647;

export class CreateProgressReportDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(REPORT_TYPES as unknown as string[])
  report_type!: string; // 'MONTHLY' | 'QUARTERLY' | 'AD_HOC' | 'WEEKLY'

  @IsDateString()
  report_date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(REPORT_NUMBER_MAX_LENGTH)
  report_number?: string;

  @IsOptional()
  @IsNumber()
  @Min(PERCENT_MIN)
  @Max(PERCENT_MAX)
  percentage_completion?: number;

  @IsOptional()
  @IsNumber()
  @Min(PERCENT_MIN)
  @Max(PERCENT_MAX)
  planned_accomplishment?: number;

  @IsOptional()
  @IsNumber()
  @Min(SLIPPAGE_MIN)
  @Max(SLIPPAGE_MAX)
  slippage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MONEY_MAX)
  cost_incurred_to_date?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MONEY_MAX)
  cost_incurred_this_period?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INT32_MAX)
  calendar_days_elapsed?: number;

  @IsOptional()
  @IsNumber()
  @Min(PERCENT_MIN)
  @Max(PERCENT_ELAPSED_MAX)
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
