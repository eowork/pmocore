import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { Readable } from 'stream';
import { StorageDriver, StoredFile } from './storage-driver.interface';
import { deriveKey, toStorageKey } from './storage-key.util';
import { numberFromConfig } from '../../common/config.util';

/**
 * S3 error codes that all mean "the object is not there". statObject and
 * getObject disagree on which one they raise depending on server version and
 * whether the caller has ListBucket permission, so match on the whole set.
 */
const NOT_FOUND_CODES = new Set([
  'NoSuchKey',
  'NotFound',
  'NoSuchObject',
  'ObjectNotFound',
]);

function isNotFound(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code ? NOT_FOUND_CODES.has(code) : false;
}

/**
 * MINIO-2: object-storage driver.
 *
 * Keys come from the same deriveKey()/toStorageKey() helpers the local driver
 * uses, so a stored `/uploads/<key>` value addresses the same object under both
 * drivers and switching STORAGE_DRIVER needs no data migration.
 *
 * NOT registered as a provider yet — Nest instantiates providers eagerly, and
 * constructing this class opens a MinIO connection. It gets built conditionally
 * by the factory in the next step, so a `local` deployment never touches MinIO.
 */
@Injectable()
export class MinioStorageDriver implements StorageDriver, OnModuleInit {
  private readonly logger = new Logger(MinioStorageDriver.name);
  private readonly client: MinioClient;
  private readonly bucket: string;
  private readonly endpointLabel: string;

  constructor(private readonly configService: ConfigService) {
    const endPoint = this.configService.get<string>('MINIO_ENDPOINT');
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY');
    const bucket = this.configService.get<string>('MINIO_BUCKET_NAME');

    // Fail at construction with the missing key names rather than letting the
    // SDK raise something opaque on the first upload. Values are never logged.
    const missing = Object.entries({
      MINIO_ENDPOINT: endPoint,
      MINIO_ACCESS_KEY: accessKey,
      MINIO_SECRET_KEY: secretKey,
      MINIO_BUCKET_NAME: bucket,
    })
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (missing.length > 0) {
      throw new Error(
        `STORAGE_DRIVER=minio requires ${missing.join(', ')} to be set. ` +
          `Under Docker these come from the root .env via docker-compose; ` +
          `for a host-run backend set them in pmo-backend/.env.`,
      );
    }

    // T-JWT-EXPIRY pattern: coerce through numberFromConfig so a blank or
    // non-numeric MINIO_PORT falls back instead of yielding NaN.
    const port = numberFromConfig(this.configService, 'MINIO_PORT', 9000);
    const useSSL =
      String(this.configService.get<string>('MINIO_USE_SSL', 'false'))
        .trim()
        .toLowerCase() === 'true';

    this.bucket = bucket;
    this.endpointLabel = `${useSSL ? 'https' : 'http'}://${endPoint}:${port}`;
    this.client = new MinioClient({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
  }

  /**
   * Verify the bucket is reachable at boot rather than on the first upload.
   *
   * Deliberately does NOT create the bucket: a typo in MINIO_BUCKET_NAME would
   * silently produce an empty one and make every existing object look missing.
   * Creation belongs to the minio-init service in docker-compose.
   */
  async onModuleInit(): Promise<void> {
    let exists: boolean;
    try {
      exists = await this.client.bucketExists(this.bucket);
    } catch (error) {
      throw new Error(
        `MINIO_UNREACHABLE: cannot reach ${this.endpointLabel} — ${error.message}`,
      );
    }
    if (!exists) {
      throw new Error(
        `MINIO_BUCKET_MISSING: bucket "${this.bucket}" does not exist at ` +
          `${this.endpointLabel}. The minio-init compose service creates it; ` +
          `for a host-run backend create it manually with: mc mb pmo/${this.bucket}`,
      );
    }
    this.logger.log(
      `MINIO_READY: endpoint=${this.endpointLabel} bucket=${this.bucket}`,
    );
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

    try {
      await this.client.putObject(this.bucket, key, file.buffer, file.size, {
        'Content-Type': file.mimetype,
        // Informational only — the database holds the authoritative name.
        // Encoded because object metadata travels as an HTTP header and the
        // original may contain non-ASCII characters.
        'x-amz-meta-original-name': encodeURIComponent(file.originalname),
      });
    } catch (error) {
      this.logger.error(
        `FILE_SAVE_ERROR: key=${this.bucket}/${key}, error=${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to store the uploaded file',
      );
    }

    this.logger.log(`FILE_SAVED: id=${id}, key=${this.bucket}/${key}`);

    return {
      id,
      originalName: file.originalname,
      fileName,
      filePath: publicPath,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  /**
   * Permanently remove an object. This genuinely destroys bytes.
   *
   * Retention for soft-deleted records is NOT enforced here — it lives at the
   * call sites, which simply do not call this (documents.service.ts,
   * media.service.ts, construction-projects removeDocument). Keeping this
   * primitive honest is what makes it usable for the backfill, for rollback and
   * for any future legally-mandated erasure.
   *
   * The one remaining caller is removeGallery, which hard-deletes its row, so
   * removing the object alongside it is correct and leaves nothing orphaned.
   */
  async delete(filePath: string): Promise<boolean> {
    const key = toStorageKey(filePath);
    try {
      // S3 DELETE is idempotent: removeObject succeeds even for a key that was
      // never there, so stat first to preserve the local driver's contract that
      // false means "nothing was removed". One extra round trip on a rare op.
      if ((await this.stat(key)) === null) {
        this.logger.warn(`FILE_DELETE_MISSING: key=${this.bucket}/${key}`);
        return false;
      }
      await this.client.removeObject(this.bucket, key);
      this.logger.log(`FILE_DELETED: key=${this.bucket}/${key}`);
      return true;
    } catch (error) {
      // removeGallery discards this boolean and drops the row regardless, so a
      // network failure here leaves an object with no reference in the database.
      // On local disk that was near-impossible; over the network it is routine.
      // Logged at ERROR with the full key so an admin can prune it via the
      // MinIO console.
      this.logger.error(
        `FILE_DELETE_ERROR: key=${this.bucket}/${key}, error=${error.message} ` +
          `— object is ORPHANED (its database row is being removed anyway)`,
      );
      return false;
    }
  }

  async getStream(filePath: string): Promise<Readable> {
    const key = toStorageKey(filePath);
    try {
      return await this.client.getObject(this.bucket, key);
    } catch (error) {
      if (isNotFound(error)) {
        // Same message the local driver and streamDocument already use.
        throw new NotFoundException('Physical file is missing on the server');
      }
      this.logger.error(
        `FILE_STREAM_ERROR: key=${this.bucket}/${key}, error=${error.message}`,
      );
      throw new InternalServerErrorException('Failed to read the stored file');
    }
  }

  /**
   * Unlike the local driver this can throw: if MinIO is unreachable, reporting
   * "false" would let callers render a clean 404 for a file that is actually
   * fine, hiding an outage. Only a genuine not-found resolves false.
   */
  async exists(filePath: string): Promise<boolean> {
    return (await this.stat(toStorageKey(filePath))) !== null;
  }

  /** statObject, with not-found normalised to null and everything else rethrown. */
  private async stat(key: string): Promise<{ size: number } | null> {
    try {
      return await this.client.statObject(this.bucket, key);
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }
}
