import { Inject, Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import {
  StorageDriver,
  StoredFile,
  STORAGE_DRIVER_TOKEN,
} from './storage-driver.interface';
import { LocalStorageDriver } from './local-storage.driver';

// Re-exported so existing importers of `./storage/storage.service` keep working
// unchanged (uploads.service.ts, uploads/index.ts).
export { StoredFile } from './storage-driver.interface';

/**
 * MINIO-1: StorageService is now a facade over the injected StorageDriver.
 *
 * Its public API is unchanged, so no consumer needed touching in this step. The
 * disk logic moved verbatim to LocalStorageDriver; which driver gets bound is a
 * module-level concern (uploads.module.ts).
 */
@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_DRIVER_TOKEN) private readonly driver: StorageDriver,
  ) {}

  async saveFile(
    file: Express.Multer.File,
    entityType?: string,
    entityId?: string,
  ): Promise<StoredFile> {
    return this.driver.save(file, entityType, entityId);
  }

  async deleteFile(filePath: string): Promise<boolean> {
    return this.driver.delete(filePath);
  }

  /**
   * Storage-agnostic reads. Nothing calls these yet — they are the replacement
   * for getFilePath()/fileExists() and get wired into streamDocument next step.
   */
  async getStream(filePath: string): Promise<Readable> {
    return this.driver.getStream(filePath);
  }

  async exists(filePath: string): Promise<boolean> {
    return this.driver.exists(filePath);
  }

  /**
   * @deprecated LOCAL-DISK ONLY — returns an absolute filesystem path, which
   * cannot exist for object storage. Superseded by getStream(). Still present
   * because construction-projects.service.ts calls it synchronously; removed in
   * the next step. Throws loudly rather than silently misbehaving if a non-local
   * driver is ever bound while a caller remains.
   */
  getFilePath(relativePath: string): string {
    return this.requireLocalDriver('getFilePath').getAbsolutePath(relativePath);
  }

  /** @deprecated LOCAL-DISK ONLY — superseded by exists(). See getFilePath(). */
  fileExists(relativePath: string): boolean {
    return this.requireLocalDriver('fileExists').existsSync(relativePath);
  }

  private requireLocalDriver(method: string): LocalStorageDriver {
    if (!(this.driver instanceof LocalStorageDriver)) {
      throw new Error(
        `StorageService.${method}() is local-disk only and cannot be used with ` +
          `the active storage driver. Migrate the caller to getStream()/exists().`,
      );
    }
    return this.driver;
  }
}
