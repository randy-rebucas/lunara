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

@Controller('partner/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly localStorageService: LocalStorageService,
  ) {}

  @Get()
  async getConversation(@Req() req: any) {
    const partnerId = this.resolvePartnerId(req);
    const data = await this.messaging.getOrCreateConversation(partnerId);
    return { success: true, data };
  }

  @Get(':id/messages')
  async listMessages(
    @Req() req: any,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const user = req.user as { sub: string; role: string };
    // Partners and staff must own the conversation
    if (user.role !== UserRole.ADMIN) {
      await this.messaging.assertOwnership(id, user.sub);
    }
    const items = await this.messaging.listMessages(id, limit ? Number(limit) : 30, before);
    return { success: true, data: { items } };
  }

  @Post(':id/send')
  async sendMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { content?: string; attachments?: any[] },
  ) {
    if (!body.content?.trim() && !body.attachments?.length) {
      throw new BadRequestException('Message must have content or at least one attachment');
    }
    const user = req.user as { sub: string; role: string; email?: string };
    const senderRole =
      user.role === UserRole.ADMIN ? 'admin' :
      user.role === UserRole.STAFF ? 'staff' : 'partner';
    const senderName = user.email ?? user.role;
    const data = await this.messaging.sendMessage(
      id,
      user.sub,
      senderRole,
      senderName,
      body.content ?? '',
      body.attachments ?? [],
    );
    return { success: true, data };
  }

  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file', attachmentUploadOptions))
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const result = await this.localStorageService.uploadBuffer(
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
    const user = req.user as { role: string };
    const role = user.role === UserRole.ADMIN ? 'admin' : 'partner';
    await this.messaging.markRead(id, role);
    return { success: true, data: { ok: true } };
  }

  private resolvePartnerId(req: any): string {
    const user = req.user as { sub: string; role: string };
    return user.sub;
  }
}

// ─── Admin-facing endpoints ───────────────────────────────────────────────────

@Controller('admin/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminMessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly localStorageService: LocalStorageService,
  ) {}

  @Get()
  async listConversations() {
    const data = await this.messaging.listAllConversations();
    return { success: true, data };
  }

  @Get(':id')
  async getConversationDetail(@Param('id') id: string) {
    const data = await this.messaging.getConversationDetail(id);
    if (!data) throw new NotFoundException('Conversation not found');
    return { success: true, data };
  }

  @Get(':id/messages')
  async listMessages(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const items = await this.messaging.listMessages(id, limit ? Number(limit) : 30, before);
    return { success: true, data: { items } };
  }

  @Post(':id/send')
  async sendMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { content?: string; attachments?: any[] },
  ) {
    if (!body.content?.trim() && !body.attachments?.length) {
      throw new BadRequestException('Message must have content or at least one attachment');
    }
    const user = req.user as { sub: string; email?: string };
    const data = await this.messaging.sendMessage(
      id,
      user.sub,
      'admin',
      user.email ?? 'Lunara Support',
      body.content ?? '',
      body.attachments ?? [],
    );
    return { success: true, data };
  }

  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file', attachmentUploadOptions))
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const result = await this.localStorageService.uploadBuffer(
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
  async markRead(@Param('id') id: string) {
    await this.messaging.markRead(id, 'admin');
    return { success: true, data: { ok: true } };
  }
}
