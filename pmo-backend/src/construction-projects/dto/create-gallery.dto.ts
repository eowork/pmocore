import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { GalleryCategory } from '../../common/enums';

/**
 * CreateGalleryDto - Aligned with schema `construction_gallery`
 *
 * Schema columns:
 * - image_url VARCHAR(500) NOT NULL (populated from upload file path)
 * - caption VARCHAR(255)
 * - category VARCHAR(50) DEFAULT 'PROGRESS'
 * - is_featured BOOLEAN DEFAULT FALSE
 * - uploaded_at TIMESTAMPTZ DEFAULT NOW() (auto)
 */
export class CreateGalleryDto {
  @IsOptional()
  @IsEnum(GalleryCategory)
  category?: GalleryCategory;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  // LB-C: User-supplied photo capture date (YYYY-MM-DD)
  @IsOptional()
  @IsDateString()
  image_taken_date?: string;
}
