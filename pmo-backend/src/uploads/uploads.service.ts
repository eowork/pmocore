import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService, StoredFile } from './storage/storage.service';
import { UploadResponseDto } from './dto';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    private storageService: StorageService,
    private configService: ConfigService,
  ) {
    this.maxFileSize = this.configService.get<number>(
      'MAX_FILE_SIZE',
      10 * 1024 * 1024,
    );
    const mimeTypesStr = this.configService.get<string>(
      'ALLOWED_MIME_TYPES',
      'image/jpeg,image/png,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
    );
    this.allowedMimeTypes = mimeTypesStr.split(',').map((t) => t.trim());
  }

  private validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize} bytes`,
      );
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    // Check for executable extensions
    const dangerousExtensions = [
      '.exe',
      '.sh',
      '.bat',
      '.cmd',
      '.ps1',
      '.vbs',
      '.js',
    ];
    const ext = file.originalname
      .toLowerCase()
      .slice(file.originalname.lastIndexOf('.'));
    if (dangerousExtensions.includes(ext)) {
      throw new BadRequestException(
        `File extension ${ext} is not allowed for security reasons`,
      );
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    entityType?: string,
    entityId?: string,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    this.validateFile(file);

    const storedFile: StoredFile = await this.storageService.saveFile(
      file,
      entityType,
      entityId,
    );

    this.logger.log(`UPLOAD_SUCCESS: id=${storedFile.id}, by=${userId}`);

    return {
      id: storedFile.id,
      originalName: storedFile.originalName,
      fileName: storedFile.fileName,
      filePath: storedFile.filePath,
      fileSize: storedFile.fileSize,
      mimeType: storedFile.mimeType,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
    };
  }

  async deleteFile(filePath: string): Promise<boolean> {
    return this.storageService.deleteFile(filePath);
  }

  getFilePath(relativePath: string): string {
    return this.storageService.getFilePath(relativePath);
  }

  fileExists(relativePath: string): boolean {
    return this.storageService.fileExists(relativePath);
  }
}
