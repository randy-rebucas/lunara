import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LocalStorageService } from '../../common/storage/local-storage.service';
import { MessagingService } from './messaging.service';
import { SendMessageDto } from './dto/send-message.dto';

const attachmentUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: (err: any, accept: boolean) => void) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Allowed types: images (JPEG, PNG, WebP), PDF, Word, Excel'), false);
    }
  },
};

/** Mirrors MessagingController (partner/messages) for the rider surface — same conversation and
 * message collections, keyed by the rider's own user id instead of a partner id. */
@Controller('riders/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RIDER)
export class RiderMessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly storageService: LocalStorageService,
  ) {}

  @Get()
  async getConversation(@Req() req: any) {
    const riderId = req.user.sub as string;
    const data = await this.messaging.getOrCreateConversation(riderId);
    return { success: true, data };
  }

  @Get(':id/messages')
  async listMessages(
    @Req() req: any,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    await this.messaging.assertOwnership(id, req.user.sub);
    const items = await this.messaging.listMessages(id, limit ? Number(limit) : 30, before);
    return { success: true, data: { items } };
  }

  @Post(':id/send')
  async sendMessage(@Req() req: any, @Param('id') id: string, @Body() body: SendMessageDto) {
    if (!body.content?.trim() && !body.attachments?.length) {
      throw new BadRequestException('Message must have content or at least one attachment');
    }
    await this.messaging.assertOwnership(id, req.user.sub);
    const user = req.user as { sub: string; email?: string };
    const data = await this.messaging.sendRiderMessage(
      id,
      user.sub,
      'rider',
      user.email ?? 'Rider',
      body.content ?? '',
      body.attachments ?? [],
    );
    return { success: true, data };
  }

  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file', attachmentUploadOptions))
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const result = await this.storageService.uploadBuffer(
      file.buffer,
      'lunara/message-attachments',
      undefined,
      'auto',
      file.mimetype,
    );
    const data = this.messaging.saveAttachment(file, result.secure_url);
    return { success: true, data };
  }

  @Patch(':id/read')
  async markRead(@Req() req: any, @Param('id') id: string) {
    await this.messaging.assertOwnership(id, req.user.sub);
    await this.messaging.markRead(id, 'partner');
    return { success: true, data: { ok: true } };
  }
}

/** Rider → connected partner (employer) channel — separate from the admin-support thread above.
 * Hidden entirely when the rider has no assigned partner yet (getConversation returns 404). */
@Controller('riders/employer-messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RIDER)
export class RiderEmployerMessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly storageService: LocalStorageService,
  ) {}

  @Get()
  async getConversation(@Req() req: any) {
    const riderId = req.user.sub as string;
    const employerId = await this.messaging.resolveEmployerId(riderId, 'rider');
    if (!employerId) throw new NotFoundException('No connected employer found');
    const data = await this.messaging.getOrCreateConversation(riderId, 'employer', employerId);
    return { success: true, data };
  }

  @Get(':id/messages')
  async listMessages(
    @Req() req: any,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    await this.messaging.assertOwnership(id, req.user.sub);
    const items = await this.messaging.listMessages(id, limit ? Number(limit) : 30, before);
    return { success: true, data: { items } };
  }

  @Post(':id/send')
  async sendMessage(@Req() req: any, @Param('id') id: string, @Body() body: SendMessageDto) {
    if (!body.content?.trim() && !body.attachments?.length) {
      throw new BadRequestException('Message must have content or at least one attachment');
    }
    await this.messaging.assertOwnership(id, req.user.sub);
    const user = req.user as { sub: string; email?: string };
    const data = await this.messaging.sendEmployerMessage(
      id,
      user.sub,
      'rider',
      user.email ?? 'Rider',
      body.content ?? '',
      body.attachments ?? [],
    );
    return { success: true, data };
  }

  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file', attachmentUploadOptions))
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const result = await this.storageService.uploadBuffer(
      file.buffer,
      'lunara/message-attachments',
      undefined,
      'auto',
      file.mimetype,
    );
    const data = this.messaging.saveAttachment(file, result.secure_url);
    return { success: true, data };
  }

  @Patch(':id/read')
  async markRead(@Req() req: any, @Param('id') id: string) {
    await this.messaging.assertOwnership(id, req.user.sub);
    await this.messaging.markEmployerConversationRead(id, 'owner');
    return { success: true, data: { ok: true } };
  }
}
