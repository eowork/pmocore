import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { UploadProgressService } from './upload-progress.service';
import { StorageService } from './storage/storage.service';
import { STORAGE_DRIVER_TOKEN } from './storage/storage-driver.interface';
import { createStorageDriver } from './storage/storage-driver.factory';

@Module({
  imports: [
    ConfigModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB — matches MAX_FILE_SIZE env default
        files: 5,
      },
    }),
  ],
  controllers: [UploadsController],
  providers: [
    UploadsService,
    StorageService,
    // Holds the per-upload SSE channels. A singleton by virtue of Nest module scope, which
    // is what lets the upload request and the SSE request meet on the same object.
    UploadProgressService,
    // MINIO-3: the driver is bound here and nowhere else, so STORAGE_DRIVER is
    // the single switch for the cutover and its rollback. Neither driver class
    // is registered as a provider — see createStorageDriver() for why.
    {
      provide: STORAGE_DRIVER_TOKEN,
      inject: [ConfigService],
      useFactory: createStorageDriver,
    },
  ],
  exports: [UploadsService, StorageService, UploadProgressService],
})
export class UploadsModule {}
