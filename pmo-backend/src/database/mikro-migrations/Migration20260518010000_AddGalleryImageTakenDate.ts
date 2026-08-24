import { Migration } from '@mikro-orm/migrations';

/**
 * Phase LB-C: Add image_taken_date to construction_gallery.
 *
 * Distinguishes WHEN a photo was captured from WHEN it was uploaded.
 * Optional field — backward compatible.
 */
export class Migration20260518010000_AddGalleryImageTakenDate extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE construction_gallery
        ADD COLUMN IF NOT EXISTS image_taken_date DATE;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE construction_gallery DROP COLUMN IF EXISTS image_taken_date;`,
    );
  }
}
