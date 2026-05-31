import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { UserRole } from '@lunara/types';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MediaService } from './media.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('rider-documents/:filename')
  getRiderDocument(
    @Param('filename') filename: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Res({ passthrough: true }) res: Response,
  ) {
    this.mediaService.assertAccess('rider-documents', filename, req.user);
    const file = this.mediaService.resolveFile('rider-documents', filename);
    res.set('Cache-Control', 'private, max-age=300');
    res.set('Content-Type', file.contentType);
    return new StreamableFile(file.stream);
  }

  @Get('task-photos/:filename')
  getTaskPhoto(
    @Param('filename') filename: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Res({ passthrough: true }) res: Response,
  ) {
    this.mediaService.assertAccess('task-photos', filename, req.user);
    const file = this.mediaService.resolveFile('task-photos', filename);
    res.set('Cache-Control', 'private, max-age=300');
    res.set('Content-Type', file.contentType);
    return new StreamableFile(file.stream);
  }
}
