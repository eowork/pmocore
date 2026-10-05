import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  TimelineAccomplishment,
  TimelineConcern,
  TimelineSignatory,
  TimelineWorkItem,
} from '../../database/entities/construction-timeline-entry.entity';

// Each item class implements the matching interface on ConstructionTimelineEntry, so the
// validated request shape and the persisted shape are checked against each other at compile
// time. Date fields are @IsString, not @IsDateString: the form initialises every row's date
// to '' and only fills it when the user picks one, and @IsOptional() skips null/undefined
// but not ''. Numeric fields are @IsOptional() so the form's explicit nulls pass through.
export class AccomplishmentItemDto implements TimelineAccomplishment {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsNumber()
  percentage?: number | null;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class SignatoryItemDto implements TimelineSignatory {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  date?: string;
}

/** MPR itemised work breakdown — one row per contract line item. */
export class WorkItemDto implements TimelineWorkItem {
  @IsOptional()
  @IsString()
  itemNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number | null;

  @IsOptional()
  @IsNumber()
  unitCost?: number | null;

  @IsOptional()
  @IsNumber()
  weightNumber?: number | null;

  @IsOptional()
  @IsNumber()
  actualPercentToDate?: number | null;

  @IsOptional()
  @IsNumber()
  costToDate?: number | null;
}

// ZZZ-G: structured Project Concern item (shared by WAR/MPR/timelogs)
export class ConcernItemDto implements TimelineConcern {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string; // SAFETY | SCHEDULE | FINANCIAL | ENVIRONMENTAL | QUALITY | OTHER

  @IsOptional()
  @IsString()
  severity?: string; // CRITICAL | HIGH | MEDIUM | LOW

  @IsOptional()
  @IsString()
  status?: string; // OPEN | IN_PROGRESS | RESOLVED

  @IsOptional()
  @IsString()
  responsibleParty?: string;

  @IsOptional()
  @IsString()
  resolutionTargetDate?: string;

  @IsOptional()
  @IsString()
  actualResolutionDate?: string;

  @IsOptional()
  @IsString()
  mitigationAction?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsString()
  createdAt?: string;
}

export const TIMELINE_ENTRY_TYPES = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
] as const;
export type TimelineEntryType = (typeof TIMELINE_ENTRY_TYPES)[number];

export class CreateTimelineEntryDto {
  @IsOptional()
  @IsIn(TIMELINE_ENTRY_TYPES as unknown as string[])
  entry_type?: TimelineEntryType;

  @IsDateString()
  entry_date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  period_label?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  weather?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  manpower_count?: number;

  @IsOptional()
  @IsString()
  equipment_used?: string;

  @IsOptional()
  @IsString()
  work_accomplished?: string;

  @IsOptional()
  @IsString()
  issues_encountered?: string;

  // LC-D: who filed this entry
  @IsOptional()
  @IsIn(['CONSTRUCTOR', 'EVALUATOR', 'INSPECTOR', 'ADMIN'])
  reporter_type?: string;

  // GGG-F: WAR fields
  @IsOptional()
  @IsString()
  @MaxLength(50)
  war_number?: string;

  @IsOptional()
  @IsDateString()
  reporting_period_start?: string;

  @IsOptional()
  @IsDateString()
  reporting_period_end?: string;

  @IsOptional()
  @IsString()
  personnel_equipment_constraints?: string;

  @IsOptional()
  @IsString()
  mitigation_measures?: string;

  @IsOptional()
  @IsString()
  look_ahead_activities?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccomplishmentItemDto)
  accomplishments?: AccomplishmentItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignatoryItemDto)
  signatories?: SignatoryItemDto[];

  // GGG-F: MPR fields
  @IsOptional()
  @IsString()
  @MaxLength(50)
  mpr_number?: string;

  @IsOptional()
  @IsDateString()
  reporting_period_month?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkItemDto)
  work_items?: WorkItemDto[];

  @IsOptional()
  @IsNumber()
  accomplishment_summary_percent?: number;

  @IsOptional()
  @IsNumber()
  percent_time_elapsed?: number;

  @IsOptional()
  @IsNumber()
  original_contract_amount?: number;

  @IsOptional()
  @IsNumber()
  revised_contract_amount?: number;

  // BBB-C: WAR/MPR financial billing (operational; Progress Reports is the official record)
  @IsOptional()
  @IsNumber()
  billing_amount_this_period?: number;

  @IsOptional()
  @IsNumber()
  financial_accomplishment_percent?: number;

  // ZZZ-G: structured Project Concerns list (shared by WAR/MPR/timelogs)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConcernItemDto)
  concerns_list?: ConcernItemDto[];
}
