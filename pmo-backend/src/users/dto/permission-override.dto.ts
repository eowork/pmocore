import {
  IsString,
  IsBoolean,
  IsIn,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ACCESS_LEVEL_VALUES } from '../../common/enums';

// Module keys that can have permission overrides
export const VALID_MODULE_KEYS = [
  'coi',
  'repairs',
  'contractors',
  'funding_sources',
  'university_operations',
  // Phase HU: Sub-module access control (Directives 212–215)
  'university-operations-physical',
  'university-operations-financial',
  'users',
] as const;

export type ModuleKey = (typeof VALID_MODULE_KEYS)[number];

export class SetPermissionOverrideDto {
  @ApiProperty({
    description: 'Module identifier',
    enum: VALID_MODULE_KEYS,
    example: 'coi',
  })
  @IsString()
  @IsIn(VALID_MODULE_KEYS)
  module_key: ModuleKey;

  @ApiProperty({
    description: 'Whether user can access this module',
    example: true,
  })
  @IsBoolean()
  can_access: boolean;

  // PHASE BBBC (Track 8a): optional CRUD level (Viewer/Contributor/Approver/Manager).
  @ApiProperty({
    description: 'Per-module CRUD level',
    required: false,
    example: 'Contributor',
  })
  @IsOptional()
  @IsString()
  granted_level?: string;
}

export interface PermissionOverride {
  id: string;
  user_id: string;
  module_key: ModuleKey;
  can_access: boolean;
  granted_level?: string | null;
  created_at: Date;
  updated_at: Date;
}

// Individual update item for bulk operations
export class BulkPermissionUpdateItem {
  @ApiProperty({
    description: 'Module identifier',
    enum: VALID_MODULE_KEYS,
    example: 'coi',
  })
  @IsString()
  @IsIn(VALID_MODULE_KEYS)
  module_key: ModuleKey;

  @ApiProperty({
    description:
      'Access permission: true=grant, false=revoke, null=remove override (use role default)',
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  can_access: boolean | null;

  // Mirrors SetPermissionOverrideDto. Without it a bulk grant could only ever write
  // granted_level = NULL, and ModuleAccessGuard rejects every write on a null level —
  // producing a row that reads "Granted" but permits nothing beyond read.
  @ApiProperty({
    description: 'Per-module CRUD level. Defaults to Viewer on a fresh grant.',
    required: false,
    enum: ACCESS_LEVEL_VALUES,
    example: 'Contributor',
  })
  @IsOptional()
  @IsString()
  @IsIn(ACCESS_LEVEL_VALUES)
  granted_level?: string;
}

// Bulk permission update DTO
export class BulkPermissionUpdateDto {
  @ApiProperty({
    description: 'Array of permission updates to apply atomically',
    type: [BulkPermissionUpdateItem],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPermissionUpdateItem)
  updates: BulkPermissionUpdateItem[];
}

export interface BulkPermissionResult {
  success: boolean;
  updated: number;
  deleted: number;
}

// Phase HV: Cross-user bulk access update (Directive 225)
export class BulkCrossUserAccessDto {
  @ApiProperty({
    description: 'Array of user IDs to update',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @ApiProperty({
    description: 'Type of access to modify',
    enum: ['permission', 'module', 'pillar'],
    example: 'permission',
  })
  @IsString()
  @IsIn(['permission', 'module', 'pillar'])
  type: 'permission' | 'module' | 'pillar';

  @ApiProperty({
    description: 'Action to perform',
    enum: ['grant', 'revoke'],
    example: 'grant',
  })
  @IsString()
  @IsIn(['grant', 'revoke'])
  action: 'grant' | 'revoke';

  @ApiProperty({
    description:
      'Key identifying the resource (module_key, module type, or pillar_type)',
    example: 'university_operations',
  })
  @IsString()
  key: string;
}

export interface BulkCrossUserResult {
  success: boolean;
  total: number;
  applied: number;
  skipped: number;
  errors: string[];
}
