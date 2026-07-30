import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@lunara/types';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ErrorLogService } from './error-log.service';
import { ReportClientErrorDto } from './dto/report-client-error.dto';

const CLIENT_ERROR_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

@Controller('admin/error-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ErrorLogController {
  constructor(private readonly errorLogService: ErrorLogService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('source') source?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.errorLogService.list({ page: Number(page), limit: Number(limit), source, search, from, to });
  }
}

/** Unauthenticated by design — frontend error boundaries fire before/without a logged-in session,
 *  and a crash is exactly when we can't rely on an auth token being valid. Rate-limited and the
 *  service caps message/stack length to bound abuse. */
@Controller('errors')
export class ClientErrorReportController {
  constructor(private readonly errorLogService: ErrorLogService) {}

  @Post('client')
  @Throttle(CLIENT_ERROR_THROTTLE)
  async report(@Body() dto: ReportClientErrorDto, @Req() req: Request) {
    await this.errorLogService.record({
      source: dto.source,
      message: dto.message,
      stack: dto.stack,
      path: dto.path,
      context: dto.digest ? { digest: dto.digest } : null,
      method: req.method,
    });
    return { success: true };
  }
}
