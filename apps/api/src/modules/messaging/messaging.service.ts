import { ForbiddenException, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { ChatMessage, MessageAttachment } from '@lunara/types';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { NotificationDispatchService } from '../push/notification-dispatch.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { User, UserDocument } from '../users/schemas/user.schema';
import { EmailService } from '../../common/email/email.service';
import { SettingsService } from '../settings/settings.service';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    @Inject(forwardRef(() => TrackingGateway))
    private readonly gateway: TrackingGateway,
    private readonly notificationDispatch: NotificationDispatchService,
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * A shop's conversation is keyed by its owning partner's userId. Staff accounts don't have
   * one of their own — resolve to their branch's partner so the whole shop (owner + staff)
   * shares one conversation with support, instead of each staff login getting its own thread.
   */
  async resolveConversationOwnerId(userId: string, role: string): Promise<string> {
    if (role === 'staff') {
      const staffUser = await this.userModel.findById(userId).select('branchId').lean();
      if (staffUser?.branchId) {
        const branch = await this.branchModel
          .findById(staffUser.branchId)
          .select('partnerUserId')
          .lean();
        if (branch?.partnerUserId) return branch.partnerUserId.toString();
      }
    }
    return userId;
  }

  async getOrCreateConversation(partnerId: string) {
    const pid = new Types.ObjectId(partnerId);
    const existing = await this.conversationModel.findOne({ partnerId: pid }).lean();
    const convoId = existing
      ? existing._id.toString()
      : (await this.conversationModel.create({ partnerId: pid }))._id.toString();
    return this.populateConversation(convoId, partnerId);
  }

  async getConversation(conversationId: string) {
    const convo = await this.conversationModel
      .findById(conversationId)
      .lean();
    if (!convo) return null;
    return this.populateConversation(conversationId, convo.partnerId.toString());
  }

  private async populateConversation(conversationId: string, partnerId: string) {
    const convo = await this.conversationModel.findById(conversationId).lean();
    if (!convo) return null;

    let lastMessage: ChatMessage | undefined;
    if (convo.lastMessageId) {
      const msg = await this.messageModel.findById(convo.lastMessageId).lean();
      if (msg) lastMessage = this.toWire(msg);
    }

    return {
      _id: convo._id.toString(),
      partnerId,
      subject: convo.subject ?? '',
      lastMessage,
      unreadCount: convo.partnerUnread,
      createdAt: (convo as any).createdAt?.toISOString() ?? '',
      updatedAt: (convo as any).updatedAt?.toISOString() ?? '',
    };
  }

  async assertOwnership(conversationId: string, userId: string) {
    const convo = await this.conversationModel
      .findById(conversationId)
      .select('partnerId')
      .lean();
    if (!convo || convo.partnerId.toString() !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  async listMessages(conversationId: string, limit = 30, before?: string) {
    const filter: Record<string, unknown> = {
      conversationId: new Types.ObjectId(conversationId),
    };
    if (before) {
      filter['_id'] = { $lt: new Types.ObjectId(before) };
    }
    const msgs = await this.messageModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit)
      .lean();
    return msgs.reverse().map((m) => this.toWire(m));
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    senderRole: string,
    senderName: string,
    content: string,
    attachments: MessageAttachment[] = [],
  ): Promise<ChatMessage> {
    const convoId = new Types.ObjectId(conversationId);
    const msg = await this.messageModel.create({
      conversationId: convoId,
      senderId: new Types.ObjectId(senderId),
      senderRole,
      senderName,
      content: content ?? '',
      attachments,
    });

    const unreadField = senderRole === 'admin' ? 'partnerUnread' : 'adminUnread';
    await this.conversationModel.findByIdAndUpdate(convoId, {
      lastMessageId: msg._id,
      $inc: { [unreadField]: 1 },
    });

    const wire = this.toWire(msg.toObject());
    this.gateway.emitNewMessage(conversationId, wire);

    // Notify the other party
    if (senderRole !== 'partner') {
      // Admin / staff sent → notify the partner
      const convo = await this.conversationModel
        .findById(conversationId)
        .select('partnerId')
        .lean();
      if (convo) {
        const pid = convo.partnerId.toString();
        const preview = content?.trim().slice(0, 80) || 'Sent an attachment';
        void this.notificationDispatch.dispatch({
          userId: pid,
          title: 'New message from Lunara Support',
          body: preview,
          data: { category: 'message', type: 'new_message', conversationId },
        });
        this.gateway.emitPartnerNotification(pid, {
          type: 'new_message',
          conversationId,
        });
      }
    } else {
      // Partner sent → notify admin (no push/socket channel for the admin inbox today, so email
      // is the only signal until one exists).
      const preview = content?.trim().slice(0, 80) || 'Sent an attachment';
      void this.notifyAdminNewMessage(senderName, preview);
    }

    return wire;
  }

  private async notifyAdminNewMessage(senderName: string, preview: string) {
    try {
      const adminEmail = await this.settingsService.getAdminNotificationEmail();
      if (!adminEmail) return;
      await this.emailService.sendAdminNewMessageNotice(adminEmail, senderName, preview);
    } catch (err) {
      this.logger.warn(`Admin new-message email skipped: ${(err as Error).message}`);
    }
  }

  async markRead(conversationId: string, role: 'partner' | 'admin') {
    const convoId = new Types.ObjectId(conversationId);
    const unreadField = role === 'partner' ? 'partnerUnread' : 'adminUnread';
    await this.conversationModel.findByIdAndUpdate(convoId, { [unreadField]: 0 });
    const senderRole = role === 'partner' ? 'admin' : 'partner';
    await this.messageModel.updateMany(
      { conversationId: convoId, senderRole, readAt: null },
      { readAt: new Date() },
    );
  }

  async listAllConversations(limit = 50) {
    const convos = await this.conversationModel
      .find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const partnerIds = convos.map((c) => c.partnerId);
    const lastMessageIds = convos.map((c) => c.lastMessageId).filter(Boolean);

    const [users, branches, lastMessages] = await Promise.all([
      this.userModel.find({ _id: { $in: partnerIds } }).lean(),
      this.branchModel.find({ partnerUserId: { $in: partnerIds } }).lean(),
      lastMessageIds.length > 0
        ? this.messageModel.find({ _id: { $in: lastMessageIds } }).lean()
        : Promise.resolve([]),
    ]);

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const branchMap = new Map(branches.map((b) => [b.partnerUserId.toString(), b]));
    const lastMessageMap = new Map(lastMessages.map((m) => [m._id.toString(), m]));

    return convos.map((c) => {
        const msg = c.lastMessageId ? lastMessageMap.get(c.lastMessageId.toString()) : undefined;
        const lastMessage = msg ? this.toWire(msg) : undefined;
        const pid = c.partnerId.toString();
        const user = userMap.get(pid);
        const branch = branchMap.get(pid);
        return {
          _id: c._id.toString(),
          partnerId: pid,
          subject: c.subject ?? '',
          lastMessage,
          unreadCount: c.adminUnread,
          recipient: {
            email: user?.email ?? null,
            phone: user?.phone ?? null,
            branchName: branch?.name ?? null,
            branchCode: branch?.code ?? null,
            city: branch?.city ?? null,
            province: branch?.province ?? null,
            line1: branch?.line1 ?? null,
          },
          createdAt: (c as any).createdAt?.toISOString() ?? '',
          updatedAt: (c as any).updatedAt?.toISOString() ?? '',
        };
      });
  }

  async getConversationDetail(conversationId: string) {
    const convo = await this.conversationModel.findById(conversationId).lean();
    if (!convo) return null;

    const [user, branch] = await Promise.all([
      this.userModel.findById(convo.partnerId).lean(),
      this.branchModel.findOne({ partnerUserId: convo.partnerId }).lean(),
    ]);

    return {
      _id: convo._id.toString(),
      partnerId: convo.partnerId.toString(),
      unreadCount: convo.adminUnread,
      recipient: {
        email: user?.email ?? null,
        phone: user?.phone ?? null,
        branchName: branch?.name ?? null,
        branchCode: branch?.code ?? null,
        city: branch?.city ?? null,
        province: branch?.province ?? null,
        line1: branch?.line1 ?? null,
      },
      createdAt: (convo as any).createdAt?.toISOString() ?? '',
    };
  }

  saveAttachment(file: Express.Multer.File, url: string): MessageAttachment {
    return {
      filename: file.originalname,
      url,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private toWire(msg: any): ChatMessage {
    return {
      _id: msg._id.toString(),
      conversationId: msg.conversationId.toString(),
      senderId: msg.senderId.toString(),
      senderRole: msg.senderRole,
      senderName: msg.senderName,
      content: msg.content ?? '',
      attachments: (msg.attachments ?? []).map((a: any) => ({
        filename: a.filename,
        url: a.url,
        mimeType: a.mimeType,
        size: a.size,
      })),
      createdAt: msg.createdAt?.toISOString?.() ?? msg.createdAt ?? '',
      readAt: msg.readAt?.toISOString?.() ?? msg.readAt ?? undefined,
    };
  }
}
