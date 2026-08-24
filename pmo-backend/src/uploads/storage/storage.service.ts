import { Inject, Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import {
  StorageDriver,
  StoredFile,
  STORAGE_DRIVER_TOKEN,
} from './storage-driver.interface';

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
   * Storage-agnostic reads — the whole public read surface.
   *
   * MINIO-4: the former getFilePath()/fileExists() pair is gone. Those leaked an
   * absolute disk path and a synchronous boolean, neither of which object
   * storage can honour, so they threw at runtime under STORAGE_DRIVER=minio and
   * took every document download with them. Deleting them, rather than keeping a
   * throwing local-only stub, is what stops the next caller reintroducing it.
   */
  async getStream(filePath: string): Promise<Readable> {
    return this.driver.getStream(filePath);
  }

  async exists(filePath: string): Promise<boolean> {
    return this.driver.exists(filePath);
  }
}
