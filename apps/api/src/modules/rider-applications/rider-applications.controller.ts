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
import { CreateRiderApplicationDto } from './dto/create-rider-application.dto';
import { UpdateRiderApplicationStatusDto } from './dto/update-rider-application-status.dto';
import { RIDER_APPLICATION_DOCUMENT_TYPES } from './rider-application-documents';
import { RiderApplicationsService } from './rider-applications.service';

const ALLOWED_DOCUMENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

const riderApplicationDocumentUploadOptions = {
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

@Controller('rider-applications')
export class RiderApplicationsController {
  constructor(private readonly riderApplicationsService: RiderApplicationsService) {}

  // Public submission is closed — the customer-web application form was removed and this
  // endpoint was being hit directly by bots. Application records are now created by staff
  // (e.g. via admin-web) after an off-platform intake, not by an anonymous POST.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @UseInterceptors(
    FileFieldsInterceptor(
      RIDER_APPLICATION_DOCUMENT_TYPES.map((name) => ({ name, maxCount: 1 })),
      riderApplicationDocumentUploadOptions,
    ),
  )
  create(
    @Body() dto: CreateRiderApplicationDto,
    @UploadedFiles() files: Record<string, Express.Multer.File[]>,
  ) {
    return this.riderApplicationsService.create(dto, files);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  list(@Query('status') status?: string) {
    return this.riderApplicationsService.list(status);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  findOne(@Param('id') id: string) {
    return this.riderApplicationsService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateRiderApplicationStatusDto) {
    return this.riderApplicationsService.updateStatus(id, dto.status, dto.rejectionReason);
  }
}
