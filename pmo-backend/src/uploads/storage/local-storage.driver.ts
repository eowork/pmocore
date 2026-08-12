import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { StorageDriver, StoredFile } from './storage-driver.interface';
import { deriveKey, toStorageKey } from './storage-key.util';

/**
 * MINIO-1: the original disk-backed implementation, moved out of StorageService
 * unchanged. Behaviour, log tags and on-disk layout are all identical to before
 * the extraction — this is the reference the MinIO driver must match.
 */
@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly logger = new Logger(LocalStorageDriver.name);
  private readonly uploadDir: string;

  constructor(private configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
    this.ensureUploadDir();
  }

  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadDir}`);
    }
  }

  async save(
    file: Express.Multer.File,
    entityType?: string,
    entityId?: string,
  ): Promise<StoredFile> {
    const { id, fileName, key, publicPath } = deriveKey(
      file.originalname,
      entityType,
      entityId,
    );
    const filePath = path.join(this.uploadDir, key);

    // Replaces the old getEntityDir() mkdir: recursive is a no-op when the
    // directory already exists, so unscoped uploads behave exactly as before.
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    // Write file to disk
    fs.writeFileSync(filePath, file.buffer);

    this.logger.log(`FILE_SAVED: id=${id}, path=${filePath}`);

    // KY-A2: prefix with /uploads so the path is server-root-relative and
    // resolvable by the static asset middleware without conflicting with frontend routes.
    return {
      id,
      originalName: file.originalname,
      fileName,
      filePath: publicPath,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  async delete(filePath: string): Promise<boolean> {
    // KY-A2: strip /uploads/ prefix if present before resolving full disk path
    const fullPath = this.getAbsolutePath(filePath);
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        this.logger.log(`FILE_DELETED: path=${fullPath}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(
        `FILE_DELETE_ERROR: path=${fullPath}, error=${error.message}`,
      );
      return false;
    }
  }

  async getStream(filePath: string): Promise<Readable> {
    const fullPath = this.getAbsolutePath(filePath);
    // Checked eagerly: createReadStream on a missing file fails via an async
    // 'error' event, which would surface as an unhandled rejection mid-response
    // instead of a clean 404. Message matches the existing streamDocument guard.
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Physical file is missing on the server');
    }
    return fs.createReadStream(fullPath);
  }

  async exists(filePath: string): Promise<boolean> {
    return fs.existsSync(this.getAbsolutePath(filePath));
  }

  /**
   * Resolve a stored path to an absolute location on disk.
   *
   * LOCAL-ONLY — deliberately NOT part of StorageDriver: object storage has no
   * filesystem path. Retained because StorageService.getFilePath()/fileExists()
   * still expose it synchronously to construction-projects.service.ts. Both go
   * away in the next step, when streamDocument moves to getStream().
   */
  getAbsolutePath(filePath: string): string {
    return path.join(this.uploadDir, toStorageKey(filePath));
  }

  /** LOCAL-ONLY synchronous existence check. See getAbsolutePath(). */
  existsSync(filePath: string): boolean {
    return fs.existsSync(this.getAbsolutePath(filePath));
  }
}
