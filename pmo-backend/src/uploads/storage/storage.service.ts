import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface StoredFile {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
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

  private sanitizeFilename(filename: string): string {
    // Remove special characters, keep alphanumeric, dots, hyphens, underscores
    return filename
      .replace(/[^a-zA-Z0-9.\-_]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 200);
  }

  private getEntityDir(entityType?: string, entityId?: string): string {
    if (entityType && entityId) {
      const dir = path.join(this.uploadDir, entityType, entityId);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    }
    return this.uploadDir;
  }

  async saveFile(
    file: Express.Multer.File,
    entityType?: string,
    entityId?: string,
  ): Promise<StoredFile> {
    const id = uuidv4();
    const ext = path.extname(file.originalname);
    const sanitizedName = this.sanitizeFilename(
      path.basename(file.originalname, ext),
    );
    const fileName = `${id}_${sanitizedName}${ext}`;
    const targetDir = this.getEntityDir(entityType, entityId);
    const filePath = path.join(targetDir, fileName);

    // Write file to disk
    fs.writeFileSync(filePath, file.buffer);

    this.logger.log(`FILE_SAVED: id=${id}, path=${filePath}`);

    // KY-A2: prefix with /uploads so the path is server-root-relative and
    // resolvable by the static asset middleware without conflicting with frontend routes.
    const relativePath = path
      .relative(this.uploadDir, filePath)
      .replace(/\\/g, '/');
    return {
      id,
      originalName: file.originalname,
      fileName,
      filePath: `/uploads/${relativePath}`,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  async deleteFile(filePath: string): Promise<boolean> {
    // KY-A2: strip /uploads/ prefix if present before resolving full disk path
    const relativePath = filePath.startsWith('/uploads/')
      ? filePath.slice('/uploads/'.length)
      : filePath;
    const fullPath = path.join(this.uploadDir, relativePath);
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

  getFilePath(relativePath: string): string {
    const rel = relativePath.startsWith('/uploads/')
      ? relativePath.slice('/uploads/'.length)
      : relativePath;
    return path.join(this.uploadDir, rel);
  }

  fileExists(relativePath: string): boolean {
    const rel = relativePath.startsWith('/uploads/')
      ? relativePath.slice('/uploads/'.length)
      : relativePath;
    return fs.existsSync(path.join(this.uploadDir, rel));
  }
}
