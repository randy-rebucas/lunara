import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { UserRole } from '@lunara/types';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentStaffBranchId, CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { MediaService } from './media.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('rider-documents/:filename')
  async getRiderDocument(
    @Param('filename') filename: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Res() res: Response,
  ) {
    await this.mediaService.assertAccess('rider-documents', filename, req.user);
    res.sendFile(this.mediaService.resolveFilePath('rider-documents', filename), (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'File not found' });
    });
  }

  @Get('task-photos/:filename')
  async getTaskPhoto(
    @Param('filename') filename: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Res() res: Response,
    @CurrentTenantId() tenantId?: string,
    @CurrentStaffBranchId() staffBranchId?: string,
  ) {
    await this.mediaService.assertAccess('task-photos', filename, req.user, tenantId, staffBranchId);
    res.sendFile(this.mediaService.resolveFilePath('task-photos', filename), (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'File not found' });
    });
  }

  @Get('remittance-proofs/:filename')
  async getRemittanceProof(
    @Param('filename') filename: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Res() res: Response,
  ) {
    await this.mediaService.assertAccess('remittance-proofs', filename, req.user);
    res.sendFile(this.mediaService.resolveFilePath('remittance-proofs', filename), (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'File not found' });
    });
  }

  @Get('rider-application-documents/:filename')
  async getRiderApplicationDocument(
    @Param('filename') filename: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Res() res: Response,
  ) {
    await this.mediaService.assertAccess('rider-application-documents', filename, req.user);
    res.sendFile(this.mediaService.resolveFilePath('rider-application-documents', filename), (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'File not found' });
    });
  }

  @Get('partner-application-documents/:filename')
  async getPartnerApplicationDocument(
    @Param('filename') filename: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Res() res: Response,
  ) {
    await this.mediaService.assertAccess('partner-application-documents', filename, req.user);
    res.sendFile(this.mediaService.resolveFilePath('partner-application-documents', filename), (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'File not found' });
    });
  }
}
