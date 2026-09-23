import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { StorageService, StoredFile } from './storage/storage.service';
import { UploadResponseDto } from './dto';
import { numberFromConfig } from '../common/config.util';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    private storageService: StorageService,
    private configService: ConfigService,
  ) {
    // T-JWT-EXPIRY (same string-vs-number pattern): coerce to a real number.
    //
    // This is the GLOBAL backstop, applied to every upload in the application. It must be
    // at least as large as the biggest per-route multer limit, otherwise a route silently
    // advertises a size it cannot accept: a 12 MB document passed the 20 MB route limit,
    // was buffered in full, and was then rejected here by a 10 MB cap the user was never
    // shown. The per-route limits stay authoritative for the differences between routes
    // (documents 20 MB, MOV 15 MB, gallery 10 MB).
    this.maxFileSize = numberFromConfig(
      this.configService,
      'MAX_FILE_SIZE',
      20 * 1024 * 1024,
    );
    // T-HOME-CMS-12 (TH12-1): fallback matches .env.example's already-correct
    // value (webp/csv/doc/xls included) — a fresh deploy without an explicit
    // ALLOWED_MIME_TYPES in .env no longer silently rejects webp uploads.
    const mimeTypesStr = this.configService.get<string>(
      'ALLOWED_MIME_TYPES',
      'image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain',
    );
    this.allowedMimeTypes = mimeTypesStr.split(',').map((t) => t.trim());
  }

  /**
   * Public so a caller can run the rejection checks BEFORE the storage write and report an
   * accurate phase to the user. uploadFile() still calls it, so this is an early check, not
   * a replacement for the one that guards the write.
   */
  /** Bytes as a human figure, so an error message is readable without arithmetic. */
  private static formatBytes(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
  }

  validateFile(file: Express.Multer.File): void {
    // Check file size. The message states BOTH sizes: naming only the limit left the user
    // comparing it against a number they did not have, and file managers report sizes in
    // KB, which made a 10485760-byte limit look like it had rejected a tiny file.
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File is ${UploadsService.formatBytes(file.size)} (${file.size} bytes); ` +
          `the maximum allowed is ${UploadsService.formatBytes(this.maxFileSize)} ` +
          `(${this.maxFileSize} bytes)`,
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

  /**
   * MINIO-4: storage-agnostic read, replacing the getFilePath()/fileExists()
   * pair this service used to expose. Those returned an absolute disk path and
   * a synchronous boolean — neither of which object storage can provide — so
   * they were removed rather than left as traps for the next caller.
   *
   * Throws NotFoundException when the object is missing, under every driver.
   */
  async getStream(filePath: string): Promise<Readable> {
    return this.storageService.getStream(filePath);
  }

  async fileExists(filePath: string): Promise<boolean> {
    return this.storageService.exists(filePath);
  }
}
