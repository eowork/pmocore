import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * MINIO-1: key derivation, shared by every StorageDriver.
 *
 * These functions are pure — no fs, no network, no config. They exist so that
 * LocalStorageDriver and a future MinioStorageDriver derive the SAME key for a
 * given upload. If each driver rolled its own, the two would drift and a stored
 * `/uploads/...` value written by one could not be resolved by the other, which
 * would turn the driver switch into a data migration.
 *
 * The `/uploads/` prefix on the public path is load-bearing: it is what gets
 * persisted to documents.file_path / construction_gallery.image_url, it is what
 * main.ts serves as static assets, and it is what
 * Migration20260514090000_FixExistingFilePaths backfilled. Do not change it.
 */

/** Public path prefix persisted in the database and served by main.ts. */
export const UPLOADS_PUBLIC_PREFIX = '/uploads/';

/**
 * Strip special characters so the name is safe as both a filesystem path
 * segment and an S3 object key. Verbatim from the original StorageService.
 */
export function sanitizeFilename(filename: string): string {
  // Remove special characters, keep alphanumeric, dots, hyphens, underscores
  return filename
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 200);
}

export interface DerivedKey {
  /** UUID identifying this upload; also the filename prefix. */
  id: string;
  /** `<uuid>_<sanitized-base><ext>` — the leaf name, no directories. */
  fileName: string;
  /**
   * Storage-relative key with POSIX separators, e.g.
   * `construction_gallery/<entityId>/<uuid>_name.jpg`. For local disk this is
   * joined onto UPLOAD_DIR; for MinIO it is the object key verbatim.
   */
  key: string;
  /** `/uploads/<key>` — the value written to the database. */
  publicPath: string;
}

/**
 * Derive the storage key for a new upload. Entity-scoped uploads nest under
 * `<entityType>/<entityId>/`; unscoped ones sit at the root — matching the
 * original getEntityDir() behaviour exactly.
 */
export function deriveKey(
  originalName: string,
  entityType?: string,
  entityId?: string,
): DerivedKey {
  const id = uuidv4();
  const ext = path.extname(originalName);
  const sanitizedName = sanitizeFilename(path.basename(originalName, ext));
  const fileName = `${id}_${sanitizedName}${ext}`;
  const key =
    entityType && entityId ? `${entityType}/${entityId}/${fileName}` : fileName;

  return { id, fileName, key, publicPath: `${UPLOADS_PUBLIC_PREFIX}${key}` };
}

/**
 * Convert a stored path back to a storage key by dropping the public prefix.
 * Values without the prefix pass through unchanged — legacy rows predating
 * KY-A2 and external http(s) links both rely on that (callers are expected to
 * filter external links out first, as streamDocument does via its
 * `application/x-google-drive-link` guard).
 */
export function toStorageKey(filePath: string): string {
  return filePath.startsWith(UPLOADS_PUBLIC_PREFIX)
    ? filePath.slice(UPLOADS_PUBLIC_PREFIX.length)
    : filePath;
}
