import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const { ok, data } = await this.healthService.check();
    if (!ok) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { success: ok, data };
  }
}
