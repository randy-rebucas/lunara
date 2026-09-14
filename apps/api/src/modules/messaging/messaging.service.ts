import { ForbiddenException, Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { ChatMessage, MessageAttachment } from '@lunara/types';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import { NotificationDispatchService } from '../push/notification-dispatch.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { User, UserDocument } from '../users/schemas/user.schema';
import { EmailService } from '../../common/email/email.service';
import { SettingsService } from '../settings/settings.service';
import { Conversation, ConversationCounterpartyType, ConversationDocument } from './schemas/conversation.schema';
import { Message, MessageDocument } from './schemas/message.schema';

/** Some legacy conversation/message documents have createdAt/updatedAt stored as plain strings
 * (from an older seed/migration) rather than Dates, so calling .toISOString() straight off the
 * lean() result can throw — normalize through `new Date()` first. */
function toIsoString(value: unknown): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

@Injectable()
export class MessagingService implements OnModuleInit {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Rider.name) private readonly riderModel: Model<RiderDocument>,
    @Inject(forwardRef(() => TrackingGateway))
    private readonly gateway: TrackingGateway,
    private readonly notificationDispatch: NotificationDispatchService,
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Older conversation docs predate the counterpartyType field and the old partnerId-alone unique
   * index. Backfill them to 'admin' (their only prior meaning) and drop the stale index so the new
   * compound (partnerId, counterpartyType) unique index can take over.
   */
  async onModuleInit() {
    try {
      await this.conversationModel.updateMany(
        { counterpartyType: { $exists: false } },
        { $set: { counterpartyType: 'admin' } },
      );
      const indexes = await this.conversationModel.collection.indexes();
      const staleIndex = indexes.find(
        (idx) => idx.key && Object.keys(idx.key).length === 1 && idx.key.partnerId === 1 && idx.unique,
      );
      if (staleIndex?.name) {
        await this.conversationModel.collection.dropIndex(staleIndex.name);
      }
    } catch (err) {
      this.logger.warn(`Conversation backfill/index migration skipped: ${(err as Error).message}`);
    }
  }

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

  async getOrCreateConversation(
    partnerId: string,
    counterpartyType: ConversationCounterpartyType = 'admin',
    employerId?: string,
  ) {
    const pid = new Types.ObjectId(partnerId);
    // Atomic upsert instead of find-then-create: (partnerId, counterpartyType) is uniquely
    // indexed, and a concurrent first visit (e.g. a double-fired effect on a brand-new account
    // with no conversation yet) can otherwise race two creates and throw an E11000 duplicate-key
    // error.
    const convo = await this.conversationModel.findOneAndUpdate(
      { partnerId: pid, counterpartyType },
      {
        $setOnInsert: {
          partnerId: pid,
          counterpartyType,
          employerId: employerId ? new Types.ObjectId(employerId) : null,
        },
      },
      { upsert: true, new: true },
    );
    return this.populateConversation(convo._id.toString(), partnerId);
  }

  /**
   * Rider/staff "message my employer" resolution: unlike the shared admin-support thread, the
   * employer channel keeps each staff member/rider's own userId as the conversation owner (no
   * collapsing to the partner-owner id) so each gets an individual thread — only employerId is
   * resolved via the org relationship.
   */
  async resolveEmployerId(userId: string, role: string): Promise<string | null> {
    if (role === 'rider') {
      const rider = await this.riderModel
        .findOne({ userId: new Types.ObjectId(userId) })
        .select('partnerId')
        .lean();
      return rider?.partnerId ? rider.partnerId.toString() : null;
    }
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
    return null;
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
      counterpartyType: convo.counterpartyType ?? 'admin',
      employerId: convo.employerId ? convo.employerId.toString() : null,
      subject: convo.subject ?? '',
      lastMessage,
      unreadCount: convo.partnerUnread,
      createdAt: toIsoString((convo as any).createdAt),
      updatedAt: toIsoString((convo as any).updatedAt),
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

  /** Employer-side ownership check for the workforce inbox: the current user must be the
   * employer the thread is addressed to. */
  async assertEmployerOwnership(conversationId: string, employerUserId: string) {
    const convo = await this.conversationModel
      .findById(conversationId)
      .select('employerId counterpartyType')
      .lean();
    if (
      !convo ||
      convo.counterpartyType !== 'employer' ||
      !convo.employerId ||
      convo.employerId.toString() !== employerUserId
    ) {
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
      // Partner sent → broadcast to every connected admin dashboard (not just admins already
      // viewing this conversation — see TrackingGateway.emitAdminNewMessage) and email the admin
      // notification address as a fallback for admins not currently online.
      this.gateway.emitAdminNewMessage(wire);
      const preview = content?.trim().slice(0, 80) || 'Sent an attachment';
      void this.notifyAdminNewMessage(senderName, preview);
    }

    return wire;
  }

  /**
   * Rider support chat reuses the same conversations/messages collections as partner chat — the
   * `partnerId` field just holds the owning user's id, and a rider's own id is unique across the
   * platform the same way a partner's is, so no schema change is needed. Kept as a separate
   * method rather than branching inside `sendMessage` above because that method's notify
   * direction is keyed off `senderRole !== 'partner'` (staff sending notifies the partner owner,
   * not admin) — reusing it as-is for `senderRole === 'rider'` would misroute the notification.
   */
  async sendRiderMessage(
    conversationId: string,
    senderId: string,
    senderRole: 'rider' | 'customer' | 'admin',
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

    if (senderRole === 'admin') {
      const convo = await this.conversationModel
        .findById(conversationId)
        .select('partnerId')
        .lean();
      if (convo) {
        const riderId = convo.partnerId.toString();
        const preview = content?.trim().slice(0, 80) || 'Sent an attachment';
        void this.notificationDispatch.dispatch({
          userId: riderId,
          title: 'New message from Lunara Support',
          body: preview,
          data: { category: 'message', type: 'new_message', conversationId },
        });
      }
    } else {
      this.gateway.emitAdminNewMessage(wire);
      const preview = content?.trim().slice(0, 80) || 'Sent an attachment';
      void this.notifyAdminNewMessage(senderName, preview);
    }

    return wire;
  }

  /**
   * Employer-channel send: counterpartyType 'employer' conversations, owned by a rider/staff
   * member, addressed to their employer. Mirrors sendRiderMessage's shape but the two parties are
   * "owner" (rider/staff, tracked via partnerUnread) and "employer" (tracked via adminUnread,
   * reusing that field's existing "other party" slot rather than adding a third counter).
   */
  async sendEmployerMessage(
    conversationId: string,
    senderId: string,
    senderRole: 'rider' | 'staff' | 'employer',
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

    const unreadField = senderRole === 'employer' ? 'partnerUnread' : 'adminUnread';
    await this.conversationModel.findByIdAndUpdate(convoId, {
      lastMessageId: msg._id,
      $inc: { [unreadField]: 1 },
    });

    const wire = this.toWire(msg.toObject());
    this.gateway.emitNewMessage(conversationId, wire);

    const convo = await this.conversationModel
      .findById(conversationId)
      .select('partnerId employerId')
      .lean();
    if (!convo) return wire;

    const preview = content?.trim().slice(0, 80) || 'Sent an attachment';
    if (senderRole === 'employer') {
      const ownerId = convo.partnerId.toString();
      void this.notificationDispatch.dispatch({
        userId: ownerId,
        title: 'New message from your employer',
        body: preview,
        data: { category: 'message', type: 'new_message', conversationId },
      });
      this.gateway.emitPartnerNotification(ownerId, { type: 'new_message', conversationId });
    } else if (convo.employerId) {
      const employerId = convo.employerId.toString();
      void this.notificationDispatch.dispatch({
        userId: employerId,
        title: `New message from ${senderName}`,
        body: preview,
        data: { category: 'message', type: 'new_message', conversationId },
      });
      this.gateway.emitPartnerNotification(employerId, { type: 'new_message', conversationId });
    }

    return wire;
  }

  /** Owner (rider/staff) or employer side mark-read for an employer-channel conversation. */
  async markEmployerConversationRead(conversationId: string, viewer: 'owner' | 'employer') {
    const convoId = new Types.ObjectId(conversationId);
    const unreadField = viewer === 'owner' ? 'partnerUnread' : 'adminUnread';
    await this.conversationModel.findByIdAndUpdate(convoId, { [unreadField]: 0 });
    const otherSenderRoles = viewer === 'owner' ? ['employer'] : ['rider', 'staff'];
    await this.messageModel.updateMany(
      { conversationId: convoId, senderRole: { $in: otherSenderRoles }, readAt: null },
      { readAt: new Date() },
    );
  }

  /** Employer's combined workforce inbox: every 'employer'-type conversation addressed to them,
   * covering both their staff and their riders in one list. */
  async listEmployerConversations(employerId: string, limit = 50) {
    const eid = new Types.ObjectId(employerId);
    const convos = await this.conversationModel
      .find({ counterpartyType: 'employer', employerId: eid })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const ownerIds = convos.map((c) => c.partnerId);
    const lastMessageIds = convos.map((c) => c.lastMessageId).filter(Boolean);

    const [users, riders, lastMessages] = await Promise.all([
      this.userModel.find({ _id: { $in: ownerIds } }).lean(),
      this.riderModel.find({ userId: { $in: ownerIds } }).lean(),
      lastMessageIds.length > 0
        ? this.messageModel.find({ _id: { $in: lastMessageIds } }).lean()
        : Promise.resolve([]),
    ]);

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const riderMap = new Map(riders.map((r) => [r.userId.toString(), r]));
    const lastMessageMap = new Map(lastMessages.map((m) => [m._id.toString(), m]));

    return convos.map((c) => {
      const msg = c.lastMessageId ? lastMessageMap.get(c.lastMessageId.toString()) : undefined;
      const lastMessage = msg ? this.toWire(msg) : undefined;
      const ownerId = c.partnerId.toString();
      const rider = riderMap.get(ownerId);
      const user = userMap.get(ownerId);
      const riderName = rider ? [rider.firstName, rider.lastName].filter(Boolean).join(' ') : null;
      return {
        _id: c._id.toString(),
        partnerId: ownerId,
        counterpartyType: 'employer' as const,
        subject: c.subject ?? '',
        lastMessage,
        unreadCount: c.adminUnread,
        recipient: rider
          ? { role: 'rider' as const, name: riderName || null, phone: user?.phone ?? null }
          : {
              role: 'staff' as const,
              name: user?.ownerName ?? user?.email ?? null,
              phone: user?.phone ?? null,
            },
        createdAt: toIsoString((c as any).createdAt),
        updatedAt: toIsoString((c as any).updatedAt),
      };
    });
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
          createdAt: toIsoString((c as any).createdAt),
          updatedAt: toIsoString((c as any).updatedAt),
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
      createdAt: toIsoString((convo as any).createdAt),
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
      // senderId is null for system/support messages seeded without a real admin user attached
      // (e.g. the demo-data "Welcome to Lunara" note) — fall back to '' rather than crash.
      senderId: msg.senderId ? msg.senderId.toString() : '',
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
