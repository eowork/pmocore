import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageDriver } from './storage-driver.interface';
import { LocalStorageDriver } from './local-storage.driver';
import { MinioStorageDriver } from './minio-storage.driver';

/** Accepted values of the STORAGE_DRIVER environment variable. */
export const STORAGE_DRIVERS = ['local', 'minio'] as const;
export type StorageDriverName = (typeof STORAGE_DRIVERS)[number];

/**
 * MINIO-3: the rollback switch.
 *
 * Exactly one driver is constructed per boot, chosen by STORAGE_DRIVER. Building
 * the instance here rather than registering both as providers is deliberate:
 * Nest instantiates providers eagerly, so a registered MinioStorageDriver would
 * open a MinIO connection even on a `local` deployment, and a registered
 * LocalStorageDriver would create UPLOAD_DIR even on a `minio` one.
 *
 * An unrecognised value throws at boot instead of silently falling back — a
 * typo'd STORAGE_DRIVER quietly writing to local disk while everyone believes
 * uploads are going to MinIO is the failure mode worth preventing.
 */
export function createStorageDriver(
  configService: ConfigService,
): StorageDriver {
  const logger = new Logger('StorageDriverFactory');
  const raw = configService.get<string>('STORAGE_DRIVER', 'local');
  const name = String(raw ?? 'local')
    .trim()
    .toLowerCase();

  switch (name) {
    case 'minio':
      // Logged before construction so a credential/connection failure is
      // attributable to the driver that was actually selected.
      logger.log('STORAGE_DRIVER_SELECTED: minio');
      return new MinioStorageDriver(configService);

    case 'local':
      logger.log('STORAGE_DRIVER_SELECTED: local');
      return new LocalStorageDriver(configService);

    default:
      throw new Error(
        `Unknown STORAGE_DRIVER "${raw}". Expected one of: ` +
          `${STORAGE_DRIVERS.join(', ')}. Leave it unset for local disk storage.`,
      );
  }
}
