import {
  ForbiddenException,
  Injectable,
  Logger,
  MessageEvent,
} from '@nestjs/common';
import { Observable, ReplaySubject, interval, merge, takeWhile } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { timer } from 'rxjs';

/**
 * Server-side phases of a document upload, in the order they occur.
 *
 * Note what this does NOT cover: the browser-to-server transfer. By the time a controller
 * runs, Multer has already buffered the whole request body, so the server cannot observe
 * the bytes arriving. Transfer progress is measured in the browser with XMLHttpRequest's
 * upload.onprogress; this stream covers everything that happens after the last byte lands,
 * which is the part the browser cannot see (MinIO write, database commit).
 *
 * 'ping' is a heartbeat, not a phase — it keeps intermediaries from closing an idle
 * connection and is ignored by the client.
 */
export type UploadPhase =
  | 'received'
  | 'validating'
  | 'storing'
  | 'stored'
  | 'persisting'
  | 'done'
  | 'failed'
  | 'ping';

export interface UploadProgressEvent {
  uploadId: string;
  phase: UploadPhase;
  message?: string;
  fileName?: string;
  /** Present on the 'done' event: the created document. */
  document?: Record<string, unknown>;
}

interface Channel {
  ownerId: string;
  subject: ReplaySubject<MessageEvent>;
  createdAt: number;
  finishedAt: number | null;
}

/**
 * In-memory registry of per-upload event streams, consumed over Server-Sent Events.
 *
 * The client generates an upload id, opens the SSE stream, then sends the file with that
 * id in the X-Upload-Id header. Opening the stream first is what makes the early phases
 * observable; a ReplaySubject covers the race anyway, so an event emitted before the
 * subscriber attaches is still delivered.
 *
 * SCOPE: single process. The channels live in this instance's memory, so a horizontally
 * scaled deployment needs the SSE request and the upload request to land on the same node
 * (sticky sessions), or this registry swapped for a shared bus such as Redis pub/sub. The
 * feature degrades to "no live phases" rather than breaking if they land apart: the upload
 * itself is a plain HTTP POST and completes regardless.
 */
@Injectable()
export class UploadProgressService {
  private readonly logger = new Logger(UploadProgressService.name);
  private readonly channels = new Map<string, Channel>();

  /** Upper bound on tracked uploads, so an abusive client cannot grow the map forever. */
  private static readonly MAX_CHANNELS = 500;
  /** An upload that never reported a terminal phase is swept after this long. */
  private static readonly ABANDONED_TTL_MS = 5 * 60 * 1000;
  /** A finished upload is kept this long so a late subscriber still sees the outcome. */
  private static readonly FINISHED_GRACE_MS = 60 * 1000;
  /** Hard stop for an SSE connection whose upload never terminates. */
  private static readonly STREAM_TIMEOUT_MS = 10 * 60 * 1000;
  private static readonly HEARTBEAT_MS = 15 * 1000;

  /**
   * Create the channel, or return the existing one.
   *
   * ownerId is recorded on creation and enforced on every later operation: an upload id is
   * guessable enough that a second user must not be able to attach to someone else's
   * stream and read their file names.
   */
  private channelFor(uploadId: string, ownerId: string): Channel {
    this.sweep();
    const existing = this.channels.get(uploadId);
    if (existing) {
      if (existing.ownerId !== ownerId) {
        throw new ForbiddenException(
          'This upload channel belongs to another user',
        );
      }
      return existing;
    }
    if (this.channels.size >= UploadProgressService.MAX_CHANNELS) {
      this.evictOldest();
    }
    const channel: Channel = {
      ownerId,
      // Buffer every event of one upload, so a subscriber that attaches mid-flight is
      // brought up to date instead of joining from wherever the stream happens to be.
      subject: new ReplaySubject<MessageEvent>(32),
      createdAt: Date.now(),
      finishedAt: null,
    };
    this.channels.set(uploadId, channel);
    return channel;
  }

  /** Open a channel ahead of the upload. Safe to call repeatedly for the same id. */
  open(uploadId: string, ownerId: string): void {
    this.channelFor(uploadId, ownerId);
  }

  /**
   * The SSE stream for one upload.
   *
   * Completes after the terminal event so the browser's reader ends cleanly rather than
   * waiting on a connection nothing will write to again, with a heartbeat in between and
   * a hard timeout in case the upload never reports an outcome.
   */
  stream(uploadId: string, ownerId: string): Observable<MessageEvent> {
    const channel = this.channelFor(uploadId, ownerId);
    const heartbeat = interval(UploadProgressService.HEARTBEAT_MS).pipe(
      map(
        (): MessageEvent => ({
          data: { uploadId, phase: 'ping' } as UploadProgressEvent,
        }),
      ),
    );
    return merge(channel.subject.asObservable(), heartbeat).pipe(
      takeUntil(timer(UploadProgressService.STREAM_TIMEOUT_MS)),
      takeWhile((event) => !this.isTerminal(event), true),
    );
  }

  /** Publish a non-terminal phase. Unknown or foreign ids are ignored, never thrown at. */
  emit(
    uploadId: string | undefined,
    ownerId: string,
    phase: UploadPhase,
    extra: Partial<UploadProgressEvent> = {},
  ): void {
    if (!uploadId) return;
    const channel = this.channels.get(uploadId);
    if (!channel || channel.ownerId !== ownerId) return;
    channel.subject.next({
      data: { uploadId, phase, ...extra } as UploadProgressEvent,
    });
  }

  /** Publish the successful outcome and close the channel. */
  finish(
    uploadId: string | undefined,
    ownerId: string,
    extra: Partial<UploadProgressEvent> = {},
  ): void {
    this.close(uploadId, ownerId, 'done', extra);
  }

  /**
   * Publish the failure and close the channel.
   *
   * The message is the same one the HTTP response carries, so the stream never becomes a
   * second, less guarded disclosure path.
   */
  fail(
    uploadId: string | undefined,
    ownerId: string,
    message: string,
    extra: Partial<UploadProgressEvent> = {},
  ): void {
    this.close(uploadId, ownerId, 'failed', { message, ...extra });
  }

  private close(
    uploadId: string | undefined,
    ownerId: string,
    phase: 'done' | 'failed',
    extra: Partial<UploadProgressEvent>,
  ): void {
    if (!uploadId) return;
    const channel = this.channels.get(uploadId);
    if (!channel || channel.ownerId !== ownerId) return;
    channel.subject.next({
      data: { uploadId, phase, ...extra } as UploadProgressEvent,
    });
    channel.subject.complete();
    channel.finishedAt = Date.now();
  }

  private isTerminal(event: MessageEvent): boolean {
    const phase = (event.data as UploadProgressEvent | undefined)?.phase;
    return phase === 'done' || phase === 'failed';
  }

  /** Drop finished channels past their grace period and uploads that never reported back. */
  private sweep(): void {
    const now = Date.now();
    for (const [id, channel] of this.channels) {
      const expired = channel.finishedAt
        ? now - channel.finishedAt > UploadProgressService.FINISHED_GRACE_MS
        : now - channel.createdAt > UploadProgressService.ABANDONED_TTL_MS;
      if (expired) {
        if (!channel.finishedAt) channel.subject.complete();
        this.channels.delete(id);
      }
    }
  }

  private evictOldest(): void {
    let oldestId: string | null = null;
    let oldestAt = Infinity;
    for (const [id, channel] of this.channels) {
      if (channel.createdAt < oldestAt) {
        oldestAt = channel.createdAt;
        oldestId = id;
      }
    }
    if (oldestId) {
      this.logger.warn(
        `UPLOAD_PROGRESS_EVICT: channel limit reached, dropping ${oldestId}`,
      );
      this.channels.get(oldestId)?.subject.complete();
      this.channels.delete(oldestId);
    }
  }
}
