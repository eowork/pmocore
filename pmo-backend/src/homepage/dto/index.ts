import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsIn,
  IsUUID,
  IsArray,
  IsISO8601,
  ValidateNested,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// T-HOME-CMS (THC-3): homepage content DTOs. Computed fields are never in DTOs.

export const HOMEPAGE_SECTION_KEYS = [
  'hero_slide',
  'highlight',
  'card',
  'faq',
  'quick_link',
  'announcement',
  // T-HOME-CMS-4 (TH4-4): About PMO CORE facets + Transparency pillars —
  // previously hardcoded, now CMS-editable via the same generic item pattern.
  'about_facet',
  'transparency_pillar',
] as const;

export const HOMEPAGE_VALUE_SOURCES = [
  'manual',
  'auto:published_count',
  'auto:ongoing_count',
  'auto:completed_count',
] as const;

export class UpdateHomepageSettingDto {
  @IsString()
  setting_value!: string;
}

export class CreateHomepageItemDto {
  @IsIn(HOMEPAGE_SECTION_KEYS as unknown as string[])
  section_key!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  item_order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  link_url?: string;

  @IsOptional()
  @IsIn(HOMEPAGE_VALUE_SOURCES as unknown as string[])
  value_source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  manual_value?: string;

  @IsOptional()
  @IsUUID()
  media_id?: string;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;

  // T-HOME-CMS-3 (TH3-5): Announcements only — enforced by section, not by DTO.
  @IsOptional()
  @IsBoolean()
  is_pinned?: boolean;

  @IsOptional()
  @IsISO8601()
  scheduled_start?: string;

  @IsOptional()
  @IsISO8601()
  scheduled_end?: string;
}

export class UpdateHomepageItemDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  item_order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  link_url?: string;

  @IsOptional()
  @IsIn(HOMEPAGE_VALUE_SOURCES as unknown as string[])
  value_source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  manual_value?: string;

  @IsOptional()
  @IsUUID()
  media_id?: string;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;

  // T-HOME-CMS-3 (TH3-5): pass an empty string to clear a schedule bound.
  @IsOptional()
  @IsBoolean()
  is_pinned?: boolean;

  @IsOptional()
  @IsString()
  scheduled_start?: string;

  @IsOptional()
  @IsString()
  scheduled_end?: string;
}

export class ReorderEntryDto {
  @IsUUID()
  id!: string;

  @IsInt()
  @Min(0)
  item_order!: number;
}

export class ReorderHomepageItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderEntryDto)
  items!: ReorderEntryDto[];
}
