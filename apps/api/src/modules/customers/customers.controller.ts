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
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { UpdateCustomerDto } from './dto/customer.dto';
import { CustomersService } from './customers.service';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly cloudinaryService: CloudinaryService,
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
    const result = await this.cloudinaryService.uploadBuffer(
      file.buffer,
      'lunara/avatars',
      `${req.user.sub}-${Date.now()}`,
    );
    return this.customersService.updateAvatar(req.user.sub, result.secure_url);
  }

  @Get('me/onboarding')
  getOnboarding(@Req() req: { user: { sub: string } }) {
    return this.customersService.getOnboardingStatus(req.user.sub);
  }
}
