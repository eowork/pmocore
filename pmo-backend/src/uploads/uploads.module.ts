import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { StorageService } from './storage/storage.service';

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
  providers: [UploadsService, StorageService],
  exports: [UploadsService, StorageService],
})
export class UploadsModule {}
