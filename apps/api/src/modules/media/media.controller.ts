import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { UserRole } from '@lunara/types';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MediaService } from './media.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('rider-documents/:filename')
  async getRiderDocument(
    @Param('filename') filename: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Res() res: Response,
  ) {
    await this.mediaService.assertAccess('rider-documents', filename, req.user);
    res.redirect(this.mediaService.getSignedUrl('rider-documents', filename));
  }

  @Get('task-photos/:filename')
  async getTaskPhoto(
    @Param('filename') filename: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Res() res: Response,
  ) {
    await this.mediaService.assertAccess('task-photos', filename, req.user);
    res.redirect(this.mediaService.getSignedUrl('task-photos', filename));
  }

  @Get('remittance-proofs/:filename')
  async getRemittanceProof(
    @Param('filename') filename: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Res() res: Response,
  ) {
    await this.mediaService.assertAccess('remittance-proofs', filename, req.user);
    res.redirect(this.mediaService.getSignedUrl('remittance-proofs', filename));
  }
}
