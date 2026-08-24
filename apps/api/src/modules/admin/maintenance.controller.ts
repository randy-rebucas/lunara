import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MaintenanceService } from './maintenance.service';

@Controller('admin/maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('status')
  async getStatus() {
    const data = await this.maintenanceService.getStatus();
    return { success: true, data };
  }

  @Post('seed')
  async runSeed(@Body('target') target: string) {
    const allowed = ['users', 'services', 'addons', 'promotions', 'blog', 'all'];
    if (!allowed.includes(target)) {
      throw new BadRequestException(`Unknown seed target: ${target}. Allowed: ${allowed.join(', ')}`);
    }
    const data = await this.maintenanceService.runSeed(
      target as 'users' | 'services' | 'addons' | 'promotions' | 'blog' | 'all',
    );
    return { success: true, data };
  }

  @Post('reset')
  async resetCollections(@Body('scope') scope: string, @Body('confirm') confirm: string) {
    if (confirm !== 'RESET') {
      throw new BadRequestException('You must pass confirm: "RESET" to proceed');
    }
    const data = await this.maintenanceService.resetCollections(scope);
    return { success: true, data };
  }

  @Post('run-script')
  async runScript(@Body('script') script: string) {
    const data = await this.maintenanceService.runScript(script);
    return { success: true, data };
  }

  @Get('backup')
  async downloadBackup(@Res() res: Response) {
    const buffer = await this.maintenanceService.createBackup();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="lunara-backup-${date}.json"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Post('restore')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  async restoreBackup(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const data = await this.maintenanceService.restoreBackup(file.buffer);
    return { success: true, data };
  }
}
