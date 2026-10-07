import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  IsUUID,
  IsIn,
  IsEnum,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Campus } from '../../common/enums';

export enum IndicatorStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Phase CT: DTO for quarterly data entry only (fixed taxonomy model)
 *
 * This DTO enforces the pillar-based model where indicators are FIXED
 * (seeded in pillar_indicator_taxonomy) and users can ONLY enter quarterly values.
 *
 * NOT ALLOWED in this DTO:
 * - particular (from taxonomy)
 * - indicator_code (from taxonomy)
 * - uacs_code (from taxonomy)
 * - variance (computed server-side)
 * - average_target (computed server-side)
 * - average_accomplishment (computed server-side)
 */
export class CreateIndicatorQuarterlyDto {
  /**
   * Which campus is reporting. Part of the record's identity, not a value: one row per campus
   * per quarter, enforced by the uq_oi_campus_quarter index. Defaults to MAIN so a client that
   * predates campus reporting keeps writing the campus its rows were backfilled to.
   */
  @IsOptional()
  @IsEnum(Campus)
  campus?: Campus;

  @IsUUID()
  @IsNotEmpty()
  pillar_indicator_id: string; // FK to pillar_indicator_taxonomy

  @IsInt()
  @Min(2020)
  @Max(2099)
  fiscal_year: number;

  // Phase DY-B: Identifies which quarterly snapshot this record belongs to
  @IsOptional()
  @IsIn(['Q1', 'Q2', 'Q3', 'Q4'])
  reported_quarter?: string;

  // Quarterly targets (nullable, supports % and counts)
  // Phase DU-B: Reasonable upper bounds to prevent typos and unrealistic entries
  // Max 99,999,999 aligns with DECIMAL(12,4) database precision
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  target_q1?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  target_q2?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  target_q3?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  target_q4?: number | null;

  // Quarterly accomplishments
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  accomplishment_q1?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  accomplishment_q2?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  accomplishment_q3?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  accomplishment_q4?: number | null;

  // Quarterly scores (ratio strings like "148/200")
  // Phase GX-3: Expanded to VARCHAR(250) to accommodate longer score expressions (Directive 347)
  @IsOptional()
  @IsString()
  @MaxLength(250)
  score_q1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  score_q2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  score_q3?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  score_q4?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  // Phase HE: APR/UPR narrative fields (Directive 386)
  // Catch-Up Plan = for Not Met Targets; Facilitating Factors = for Met Targets; Ways Forward = general
  @IsOptional()
  @IsString()
  catch_up_plan?: string | null;

  @IsOptional()
  @IsString()
  facilitating_factors?: string | null;

  @IsOptional()
  @IsString()
  ways_forward?: string | null;

  // Phase FY-2: Optional annual rate override — when set, replaces computed accomplishment_rate (Directive 213)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999.99)
  override_rate?: number | null;

  // Phase GY/GZ: Annual variance override — when set, replaces computed annual variance (Directives 356, 359)
  @IsOptional()
  @IsNumber()
  @Min(-999999.99)
  @Max(999999.99)
  override_variance?: number | null;

  // Phase HA: Optional total overrides — when set, effectiveTarget/Actual replace quarterly sums
  // as base for variance and rate computation (Directive 368)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  override_total_target?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  override_total_actual?: number | null;

  // Phase HK: MOV (Means of Verification) field (Directive 139)
  @IsOptional()
  @IsString()
  mov?: string | null;

  // Phase TTT: Numerator/denominator fraction fields for PERCENTAGE unit_type indicators
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  numerator_q1?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  denominator_q1?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  numerator_q2?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  denominator_q2?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  numerator_q3?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  denominator_q3?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  numerator_q4?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  denominator_q4?: number | null;

  // Phase XXX: Target-fraction fields for PERCENTAGE unit_type indicators (XXX-A/B)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  target_numerator_q1?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  target_denominator_q1?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  target_numerator_q2?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  target_denominator_q2?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  target_numerator_q3?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  target_denominator_q3?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  target_numerator_q4?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  target_denominator_q4?: number | null;

  // Phase XXX: Per-quarter notes/remarks (Issue A, XXX-F)
  @IsOptional()
  @IsString()
  remarks_q1?: string | null;

  @IsOptional()
  @IsString()
  remarks_q2?: string | null;

  @IsOptional()
  @IsString()
  remarks_q3?: string | null;

  @IsOptional()
  @IsString()
  remarks_q4?: string | null;

  // Phase XXX: Override fraction text fields (Issue D, XXX-G)
  @IsOptional()
  @IsString()
  override_total_target_fraction?: string | null;

  @IsOptional()
  @IsString()
  override_total_actual_fraction?: string | null;
}

/**
 * DEPRECATED: Legacy DTO for dynamic indicator CRUD
 *
 * This DTO allowed free-form indicator creation which violates BAR1 compliance.
 * Use CreateIndicatorQuarterlyDto instead.
 *
 * Will be removed after frontend refactor complete.
 */

export class CreateIndicatorDto {
  @IsString()
  @IsNotEmpty()
  particular: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  indicator_code?: string;

  @IsOptional()
  @IsString()
  uacs_code?: string;

  @IsInt()
  @IsNotEmpty()
  fiscal_year: number;

  @IsOptional()
  @IsNumber()
  target_q1?: number;

  @IsOptional()
  @IsNumber()
  target_q2?: number;

  @IsOptional()
  @IsNumber()
  target_q3?: number;

  @IsOptional()
  @IsNumber()
  target_q4?: number;

  @IsOptional()
  @IsNumber()
  accomplishment_q1?: number;

  @IsOptional()
  @IsNumber()
  accomplishment_q2?: number;

  @IsOptional()
  @IsNumber()
  accomplishment_q3?: number;

  @IsOptional()
  @IsNumber()
  accomplishment_q4?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
