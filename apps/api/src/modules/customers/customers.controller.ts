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
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AVATAR_UPLOAD_DIR } from '../../common/uploads/upload-paths';
import { UpdateCustomerDto } from './dto/customer.dto';
import { CustomersService } from './customers.service';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

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
      storage: diskStorage({
        destination: AVATAR_UPLOAD_DIR,
        filename: (req, file, cb) => {
          const userId = (req as { user?: { sub: string } }).user?.sub ?? 'user';
          const ext = extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `${userId}-${Date.now()}${ext}`);
        },
      }),
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
  uploadAvatar(
    @Req() req: { user: { sub: string } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Avatar image is required');
    }
    return this.customersService.updateAvatar(req.user.sub, file.filename);
  }

  @Get('me/onboarding')
  getOnboarding(@Req() req: { user: { sub: string } }) {
    return this.customersService.getOnboardingStatus(req.user.sub);
  }
}
