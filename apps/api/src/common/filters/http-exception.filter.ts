import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorLogService } from '../../modules/error-log/error-log.service';

interface AuthedRequest extends Request {
  user?: { sub?: string; role?: string };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(private readonly errorLogService: ErrorLogService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AuthedRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong on our end. Please try again in a moment.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        if (typeof b['message'] === 'string') {
          message = b['message'];
        } else if (Array.isArray(b['message']) && b['message'].length > 0) {
          message = (b['message'] as string[]).join(', ');
        }
      }
      // An HttpException can still carry status >= 500 (e.g. a deliberate
      // InternalServerErrorException) — those get the same generic, reference-coded message as an
      // unexpected error in production, since their raw message can also leak internal detail.
      if (status >= 500 && process.env.NODE_ENV === 'production') {
        message = 'Something went wrong on our end. Please try again in a moment.';
      }
    }
    // Non-HttpException errors (e.g. raw Mongoose/driver failures) can contain internal
    // detail (connection strings, field/collection names, query payloads) that shouldn't
    // reach clients in any environment — the real message is logged server-side below and
    // surfaced only via the (reference: ...) lookup in /admin/error-logs.

    // Only 5xx (server-side failures) get persisted — 4xx are expected client/validation errors
    // and would flood the log with noise (bad input, expired tokens, etc.).
    if (status >= 500) {
      const error = exception instanceof Error ? exception : undefined;
      if (!(exception instanceof Error)) {
        this.logger.error(`Non-Error exception thrown: ${JSON.stringify(exception)}`);
      }
      const logId = await this.errorLogService.record({
        source: 'api',
        message: error?.message ?? message,
        stack: error?.stack,
        path: request?.originalUrl,
        method: request?.method,
        statusCode: status,
        userId: request?.user?.sub,
        userRole: request?.user?.role,
      });
      // Last 8 chars of the Mongo ObjectId is enough to look the entry up in /admin/error-logs
      // without printing a full internal id to the end user.
      const reference = logId ? logId.slice(-8) : undefined;
      response.status(status).json({
        success: false,
        error: {
          message: reference ? `${message} (reference: ${reference})` : message,
          statusCode: status,
          reference,
        },
      });
      return;
    }

    response.status(status).json({
      success: false,
      error: { message, statusCode: status },
    });
  }
}
