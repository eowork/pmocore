import { Logger, NotFoundException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { StorageService } from './storage/storage.service';
import { UPLOADS_PUBLIC_PREFIX } from './storage/storage-key.util';

/**
 * MINIO-4: serve stored images by streaming them out of the active storage
 * driver instead of off the filesystem.
 *
 * This replaces app.useStaticAssets(uploadDir) — which can only ever read local
 * disk — while leaving the image-extension whitelist in main.ts untouched in
 * front of it. Proxying rather than issuing presigned URLs keeps the security
 * posture identical: the bucket stays private, nothing is publicly addressable,
 * and the same request either passes the whitelist or gets the same 403.
 *
 * Mounted at /uploads, so Express strips that prefix and req.path is the
 * storage key with a leading slash.
 */

/** Content types for exactly the extensions main.ts admits. */
const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
};

export function contentTypeFor(key: string): string {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Reject anything that could escape the upload root.
 *
 * The static middleware resolved this for us; a hand-rolled handler must do it
 * explicitly, because the key now flows from the URL into path.join() inside
 * LocalStorageDriver. Without this, /uploads/../../somewhere/else.png would read
 * an arbitrary image from disk. Empty segments are rejected too, so `//` and
 * trailing slashes cannot produce a surprising join.
 */
export function isSafeKey(key: string): boolean {
  if (!key || key.includes('\0') || key.includes('\\')) {
    return false;
  }
  return key
    .split('/')
    .every(
      (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
    );
}

export function createUploadedFilesHandler(storage: StorageService) {
  const logger = new Logger('UploadedFiles');

  return async function serveUploadedFile(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    let key: string;
    try {
      key = decodeURIComponent(req.path).replace(/^\/+/, '');
    } catch {
      // Malformed percent-encoding — decodeURIComponent throws URIError.
      res.status(400).json({ statusCode: 400, message: 'Malformed path' });
      return;
    }

    if (!isSafeKey(key)) {
      logger.warn(`UPLOAD_PATH_REJECTED: path=${req.path}`);
      res.status(404).json({ statusCode: 404, message: 'Not found' });
      return;
    }

    const storedPath = `${UPLOADS_PUBLIC_PREFIX}${key}`;

    try {
      // Keys are UUID-prefixed and never overwritten — a given URL always
      // denotes the same bytes — so the response is safely immutable. The old
      // static server sent max-age=0 + ETag, making the browser revalidate every
      // image on every page; caching outright avoids a round trip per image,
      // which matters more now that each one is a call into object storage.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Type', contentTypeFor(key));

      if (req.method === 'HEAD') {
        if (!(await storage.exists(storedPath))) {
          res.status(404).json({ statusCode: 404, message: 'Not found' });
          return;
        }
        res.end();
        return;
      }

      const stream = await storage.getStream(storedPath);

      stream.on('error', (error: Error) => {
        logger.error(`UPLOAD_STREAM_ERROR: key=${key}, error=${error.message}`);
        // Headers are already flushed once piping starts; the only honest signal
        // left is to tear the connection down so the client sees a failure
        // rather than a silently truncated image.
        res.destroy(error);
      });

      stream.pipe(res);
    } catch (error) {
      if (error instanceof NotFoundException) {
        res.status(404).json({ statusCode: 404, message: 'Not found' });
        return;
      }
      logger.error(
        `UPLOAD_SERVE_ERROR: key=${key}, error=${(error as Error).message}`,
      );
      res
        .status(500)
        .json({ statusCode: 500, message: 'Internal server error' });
    }
  };
}
