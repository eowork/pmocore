import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Postgres SQLSTATE codes that mean the request carried a value the column cannot
 * store. They are caused by client input, not by a server fault, so they are reported
 * as 4xx instead of the opaque 500 the raw driver error would produce.
 *
 * The driver message is deliberately NOT forwarded to the client: it contains the full
 * UPDATE/INSERT statement with column names and values. It is still logged server-side.
 */
const SQLSTATE_TO_HTTP: Record<string, { status: number; message: string }> = {
  '22001': {
    status: HttpStatus.BAD_REQUEST,
    message: 'A submitted value is longer than the field allows',
  },
  '22003': {
    status: HttpStatus.BAD_REQUEST,
    message: 'A submitted number is outside the range the field allows',
  },
  '22007': {
    status: HttpStatus.BAD_REQUEST,
    message: 'A submitted date is not in a valid format',
  },
  '22008': {
    status: HttpStatus.BAD_REQUEST,
    message: 'A submitted date is outside the supported range',
  },
  '22P02': {
    status: HttpStatus.BAD_REQUEST,
    message: 'A submitted value is not valid for its field type',
  },
  '23502': {
    status: HttpStatus.BAD_REQUEST,
    message: 'A required field was left empty',
  },
  '23503': {
    status: HttpStatus.BAD_REQUEST,
    message: 'A referenced record does not exist',
  },
  '23505': {
    status: HttpStatus.CONFLICT,
    message: 'A record with these values already exists',
  },
};

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  method: string;
  requestId?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as Record<string, unknown>;
        message = Array.isArray(res.message)
          ? res.message.join(', ')
          : (res.message as string) || exception.message;
        error = (res.error as string) || exception.name;
      } else {
        message = exception.message;
        error = exception.name;
      }
    } else if (exception instanceof Error) {
      // MikroORM wraps driver failures in DriverException and copies the Postgres
      // SQLSTATE onto .code. Without this mapping a value the client sent that the
      // column cannot store (too long, out of range, unparseable) is reported as a
      // 500, which tells the caller nothing and hides a fixable client-side mistake.
      const sqlState = (exception as { code?: unknown }).code;
      const mapped =
        typeof sqlState === 'string' ? SQLSTATE_TO_HTTP[sqlState] : undefined;

      if (mapped) {
        status = mapped.status;
        message = mapped.message;
        error = status === HttpStatus.CONFLICT ? 'Conflict' : 'Bad Request';
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Internal server error';
        error = 'Internal Server Error';
      }

      // Log the driver/runtime detail server-side either way; the client only ever
      // sees the sanitised message above. A mapped (client-caused) failure is a warning,
      // an unmapped one is a genuine server fault and keeps the full stack.
      if (mapped) {
        this.logger.warn(`Rejected request: ${exception.message}`);
      } else {
        this.logger.error(
          `Unhandled exception: ${exception.message}`,
          exception.stack,
        );
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'Internal Server Error';

      this.logger.error(`Unknown exception type: ${JSON.stringify(exception)}`);
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // Add request ID if available (useful for tracing)
    const requestId = request.headers['x-request-id'] as string;
    if (requestId) {
      errorResponse.requestId = requestId;
    }

    // Log error details (excluding sensitive info)
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${message}`,
      );
    } else if (status >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} - ${status} - ${message}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
