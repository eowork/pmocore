import { Readable } from 'stream';

/**
 * Metadata returned after persisting one file.
 *
 * `filePath` is the server-root-relative public path (`/uploads/...`) that gets
 * written to the database. Every driver MUST return this same shape and the same
 * key format, so swapping drivers needs no data migration.
 */
export interface StoredFile {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

/**
 * MINIO-1: the storage seam.
 *
 * A driver owns *where the bytes live* and nothing else. Validation, MIME
 * whitelisting and size limits stay in UploadsService, so they apply identically
 * no matter which driver is active.
 *
 * Every method is async by contract even where the local implementation could be
 * synchronous — object storage is a network call, and forcing that shape now
 * means adding MinioStorageDriver requires no signature churn.
 *
 * All `filePath` arguments accept the stored public path (`/uploads/<key>`) or a
 * bare key; use toStorageKey() from storage-key.util.ts to normalise.
 */
export interface StorageDriver {
  /** Persist bytes and return the metadata to store in the database. */
  save(
    file: Express.Multer.File,
    entityType?: string,
    entityId?: string,
  ): Promise<StoredFile>;

  /**
   * Permanently remove an object. Resolves false when nothing was removed —
   * either it was already absent, or the removal failed (see driver logs).
   *
   * This is a raw storage primitive and always destroys bytes. Retention for
   * soft-deleted records is enforced by the callers, which simply do not call
   * it; see documents.service.ts, media.service.ts and
   * construction-projects.service.ts removeDocument().
   */
  delete(filePath: string): Promise<boolean>;

  /** Open a read stream. Throws NotFoundException when the object is missing. */
  getStream(filePath: string): Promise<Readable>;

  /** Whether the object is present in the backing store. */
  exists(filePath: string): Promise<boolean>;
}

/**
 * DI token for the active driver. Named *_TOKEN to keep it distinct from the
 * STORAGE_DRIVER environment variable, which selects which driver is bound.
 */
export const STORAGE_DRIVER_TOKEN = 'STORAGE_DRIVER';
