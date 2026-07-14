import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

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
    } else if (exception instanceof Error) {
      // Non-HttpException errors (e.g. raw Mongoose/driver failures) can contain internal
      // detail (connection strings, field/collection names) that shouldn't reach clients in
      // production — log the real message server-side and return a generic one instead.
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(exception.message, exception.stack);
      } else {
        message = exception.message;
      }
    }

    response.status(status).json({
      success: false,
      error: { message, statusCode: status },
    });
  }
}
