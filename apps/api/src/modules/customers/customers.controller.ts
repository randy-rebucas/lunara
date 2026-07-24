import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CloudinaryStorageService } from '../../common/storage/cloudinary-storage.service';
import { UpdateCustomerDto } from './dto/customer.dto';
import { CustomersService } from './customers.service';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly cloudinaryStorageService: CloudinaryStorageService,
  ) {}

  @Get('me')
  getMe(@Req() req: { user: { sub: string } }) {
    return this.customersService.getProfile(req.user.sub);
  }

  @Patch('me')
  updateMe(@Req() req: { user: { sub: string } }, @Body() dto: UpdateCustomerDto) {
    return this.customersService.updateProfile(req.user.sub, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
          cb(new BadRequestException('Only JPEG, PNG, and WebP images are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadAvatar(
    @Req() req: { user: { sub: string } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Avatar image is required');
    }
    const result = await this.cloudinaryStorageService.uploadBuffer(
      file.buffer,
      'lunara/avatars',
      `${req.user.sub}-${Date.now()}`,
      'image',
      file.mimetype,
    );
    const { previousAvatarUrl, ...response } = await this.customersService.updateAvatar(req.user.sub, result.secure_url);
    await this.cloudinaryStorageService.deleteFile('lunara/avatars', previousAvatarUrl);
    return response;
  }

  @Get('me/onboarding')
  getOnboarding(@Req() req: { user: { sub: string } }) {
    return this.customersService.getOnboardingStatus(req.user.sub);
  }

  @Get('me/business-summary')
  getBusinessSummary(@Req() req: { user: { sub: string } }) {
    return this.customersService.getBusinessSummary(req.user.sub);
  }

  @Get('me/impact')
  getImpact(@Req() req: { user: { sub: string } }) {
    return this.customersService.getImpactSummary(req.user.sub);
  }
}
