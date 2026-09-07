import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PartnerSignupDto } from './dto/partner-signup.dto';
import { PartnerOnboardingService } from './partner-onboarding.service';

const SIGNUP_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

const logoUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, ok: boolean) => void) => {
    if (!ALLOWED_LOGO_TYPES.has(file.mimetype)) {
      cb(new BadRequestException('Only JPEG, PNG, and WebP images are allowed'), false);
      return;
    }
    cb(null, true);
  },
};

/**
 * Public, unauthenticated self-serve partner signup — deliberately separate from
 * `partner-applications` (the document-review queue, admin-only after prior bot abuse). Creates
 * the account immediately; the account is unusable until email verification (existing
 * `isEmailVerified` login gate in auth.service.ts).
 */
@Controller('partner-onboarding')
export class PartnerOnboardingController {
  constructor(private readonly onboardingService: PartnerOnboardingService) {}

  @Post('signup')
  @Throttle(SIGNUP_THROTTLE)
  @UseInterceptors(FileInterceptor('logo', logoUploadOptions))
  async signup(@Body('payload') payload: string, @UploadedFile() logo?: Express.Multer.File) {
    if (!payload) {
      throw new BadRequestException('Missing signup payload');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new BadRequestException('Malformed signup payload');
    }

    const dto = plainToInstance(PartnerSignupDto, parsed);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: false });
    if (errors.length > 0) {
      const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
      throw new BadRequestException(messages.length ? messages : 'Invalid signup data');
    }

    const result = await this.onboardingService.signup(dto, logo);
    return { success: true, data: result };
  }
}
