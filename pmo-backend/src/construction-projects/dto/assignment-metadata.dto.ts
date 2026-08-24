import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Per-assignment metadata captured admin-side for client prototype team display
 * (Phase JW-E). When `assignments[]` is provided on a project create/update
 * payload, the backend takes precedence over the legacy `assigned_user_ids[]`
 * (string IDs only).
 */
export class AssignmentMetadataDto {
  @IsUUID()
  user_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  // KD-D: Governance category — IMPLEMENTING / MONITORING / UNIVERSITY_OFFICIAL / OVERSIGHT
  @IsOptional()
  @IsString()
  @MaxLength(50)
  personnel_category?: string;

  // PA-C: Human-readable project role (e.g. "Project Engineer", "Inspector")
  @IsOptional()
  @IsString()
  @MaxLength(100)
  project_role?: string;

  // PA-C: Per-assignment permission overrides (Admin-set; default = viewer-only for non-Admins)
  @IsOptional()
  permissions?: Record<string, any>;
}
