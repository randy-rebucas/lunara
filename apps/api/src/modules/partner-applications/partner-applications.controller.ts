import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePartnerApplicationDto } from './dto/create-partner-application.dto';
import { UpdatePartnerApplicationStatusDto } from './dto/update-partner-application-status.dto';
import { PARTNER_APPLICATION_DOCUMENT_TYPES } from './partner-application-documents';
import { PartnerApplicationsService } from './partner-applications.service';

const ALLOWED_DOCUMENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

const partnerApplicationDocumentUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, ok: boolean) => void,
  ) => {
    if (!ALLOWED_DOCUMENT_TYPES.has(file.mimetype)) {
      cb(new BadRequestException('Only JPEG, PNG, and WebP images are allowed'), false);
      return;
    }
    cb(null, true);
  },
};

@Controller('partner-applications')
export class PartnerApplicationsController {
  constructor(private readonly partnerApplicationsService: PartnerApplicationsService) {}

  // Public submission is closed — the customer-web application form was removed and this
  // endpoint was being hit directly by bots. Application records are now created by staff
  // (e.g. via admin-web) after an off-platform intake, not by an anonymous POST.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @UseInterceptors(
    FileFieldsInterceptor(
      PARTNER_APPLICATION_DOCUMENT_TYPES.map((name) => ({ name, maxCount: 1 })),
      partnerApplicationDocumentUploadOptions,
    ),
  )
  create(
    @Body() dto: CreatePartnerApplicationDto,
    @UploadedFiles() files: Record<string, Express.Multer.File[]>,
  ) {
    return this.partnerApplicationsService.create(dto, files);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  list(@Query('status') status?: string) {
    return this.partnerApplicationsService.list(status);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  findOne(@Param('id') id: string) {
    return this.partnerApplicationsService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePartnerApplicationStatusDto) {
    return this.partnerApplicationsService.updateStatus(id, dto.status, dto.rejectionReason);
  }
}
