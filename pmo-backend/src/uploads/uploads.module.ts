import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
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
    // MINIO-3: the driver is bound here and nowhere else, so STORAGE_DRIVER is
    // the single switch for the cutover and its rollback. Neither driver class
    // is registered as a provider — see createStorageDriver() for why.
    {
      provide: STORAGE_DRIVER_TOKEN,
      inject: [ConfigService],
      useFactory: createStorageDriver,
    },
  ],
  exports: [UploadsService, StorageService],
})
export class UploadsModule {}
