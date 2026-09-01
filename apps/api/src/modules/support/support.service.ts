import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import { getProcessingStep, LAUNDRY_PROCESSING_STEPS, LOST_ITEM_FLOW } from '@lunara/utils';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { AddressesService } from '../addresses/addresses.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { WalletsService } from '../wallets/wallets.service';
import { LedgerService } from '../ledger/ledger.service';
import { EmailService } from '../../common/email/email.service';
import { SettingsService } from '../settings/settings.service';
import { CreateLostItemDto } from './dto/create-lost-item.dto';
import { CreateAreaRequestDto } from './dto/create-area-request.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateRiderIssueDto, RiderIssueType } from './dto/create-rider-issue.dto';
import { InvestigateAction, InvestigateTicketDto } from './dto/investigate-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import {
  LostItemStage,
  SupportTicket,
  SupportTicketDocument,
  TicketOutcome,
  TicketPriority,
  TicketStatus,
  TicketType,
} from './schemas/support-ticket.schema';

const DEFAULT_TICKETS = [
  {
    subject: 'Order delayed — no rider assigned',
    description: 'Customer booked 2 days ago, status still confirmed. Needs escalation.',
    status: TicketStatus.OPEN,
    priority: TicketPriority.HIGH,
    customerEmail: 'customer@example.com',
    type: TicketType.GENERAL,
  },
  {
    subject: 'Missing dress shirt after delivery',
    description: 'White cotton dress shirt not returned with order. Tag LN-8821.',
    status: TicketStatus.IN_PROGRESS,
    priority: TicketPriority.HIGH,
    type: TicketType.LOST_ITEM,
    investigationStage: LostItemStage.INVESTIGATION,
    missingItems: ['White dress shirt'],
    outcome: TicketOutcome.PENDING,
    timeline: [
      { stage: 'complaint', label: 'Customer complaint', at: new Date() },
      { stage: 'investigation', label: 'Investigation', at: new Date() },
    ],
  },
];

const ELIGIBLE_LOST_ITEM_STATUSES = [
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    @InjectModel(SupportTicket.name) private ticketModel: Model<SupportTicketDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private addressesService: AddressesService,
    private walletsService: WalletsService,
    private ledgerService: LedgerService,
    private emailService: EmailService,
    private settingsService: SettingsService,
  ) {}

  private async notifyAdminNewTicket(ticketId: string, subject: string) {
    try {
      const adminEmail = await this.settingsService.getAdminNotificationEmail();
      if (!adminEmail) return;
      await this.emailService.sendAdminNewTicketNotice(adminEmail, ticketId, subject);
    } catch (err) {
      this.logger.warn(`Admin new-ticket email skipped for ticket ${ticketId}: ${(err as Error).message}`);
    }
  }

  async ensureSeeded() {
    const count = await this.ticketModel.countDocuments();
    if (count === 0) await this.ticketModel.insertMany(DEFAULT_TICKETS);
  }

  async countOpenTickets() {
    return this.ticketModel.countDocuments({
      status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
    });
  }

  async createGeneralTicket(customerId: string, dto: CreateTicketDto) {
    let orderId: Types.ObjectId | undefined;
    if (dto.orderId) {
      const order = await this.orderModel.findById(dto.orderId);
      if (!order) throw new NotFoundException('Order not found');
      if (order.customerId.toString() !== customerId) {
        throw new ForbiddenException('This order does not belong to you');
      }
      orderId = order._id;
    }

    const user = await this.userModel.findById(customerId).select('email');
    const ticket = await this.ticketModel.create({
      subject: dto.subject.trim(),
      description: dto.description.trim(),
      type: TicketType.GENERAL,
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      customerId: new Types.ObjectId(customerId),
      customerEmail: user?.email,
      orderId,
      timeline: [
        {
          stage: 'submitted',
          label: 'Customer submitted ticket',
          at: new Date(),
        },
      ],
    });

    void this.notifyAdminNewTicket(ticket._id.toString(), ticket.subject);

    return {
      success: true,
      data: this.serializeTicketForCustomer(ticket),
      message: 'Your request was submitted. We will respond as soon as we can.',
    };
  }

  private static readonly RIDER_ISSUE_TYPE_MAP: Record<RiderIssueType, TicketType> = {
    [RiderIssueType.DAMAGED_ITEM]: TicketType.DAMAGED_ITEM,
    [RiderIssueType.DELIVERY_DELAY]: TicketType.DELIVERY_DELAY,
    [RiderIssueType.OTHER]: TicketType.GENERAL,
  };

  async createRiderIssueTicket(riderId: string, dto: CreateRiderIssueDto) {
    let orderId: Types.ObjectId | undefined;
    if (dto.orderId) {
      const order = await this.orderModel.findById(dto.orderId);
      if (!order) throw new NotFoundException('Order not found');
      const isAssignedRider =
        order.pickupRiderId?.toString() === riderId || order.deliveryRiderId?.toString() === riderId;
      if (!isAssignedRider) {
        throw new ForbiddenException('This order is not assigned to you');
      }
      orderId = order._id;
    }

    const ticket = await this.ticketModel.create({
      subject: dto.subject.trim(),
      description: dto.description.trim(),
      type: SupportService.RIDER_ISSUE_TYPE_MAP[dto.issueType],
      status: TicketStatus.OPEN,
      priority: dto.issueType === RiderIssueType.DAMAGED_ITEM ? TicketPriority.HIGH : TicketPriority.MEDIUM,
      riderId: new Types.ObjectId(riderId),
      orderId,
      timeline: [
        {
          stage: 'submitted',
          label: 'Rider submitted issue report',
          at: new Date(),
        },
      ],
    });

    return {
      success: true,
      data: this.serializeTicketForRider(ticket),
      message: 'Your report was submitted. Dispatch will follow up if needed.',
    };
  }

  async listRiderTickets(riderId: string) {
    const items = await this.ticketModel
      .find({ riderId: new Types.ObjectId(riderId) })
      .sort({ updatedAt: -1 })
      .limit(50);
    return { success: true, data: items.map((t) => this.serializeTicketForRider(t)) };
  }

  async getRiderTicket(riderId: string, ticketId: string) {
    const ticket = await this.ticketModel.findById(ticketId);
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.riderId?.toString() !== riderId) {
      throw new ForbiddenException('Access denied');
    }
    return { success: true, data: this.serializeTicketForRider(ticket) };
  }

  async createLostItemComplaint(customerId: string, dto: CreateLostItemDto) {
    const order = await this.orderModel.findById(dto.orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId.toString() !== customerId) {
      throw new ForbiddenException('This order does not belong to you');
    }
    if (!ELIGIBLE_LOST_ITEM_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        'Lost item reports are available after your order is delivered',
      );
    }

    const existing = await this.ticketModel.findOne({
      orderId: order._id,
      type: TicketType.LOST_ITEM,
      status: { $nin: [TicketStatus.CLOSED, TicketStatus.RESOLVED] },
    });
    if (existing) {
      throw new BadRequestException('An open lost-item ticket already exists for this order');
    }

    const user = await this.userModel.findById(customerId).select('email');
    const subject = `Lost item — order ${order._id.toString().slice(-6)}`;
    const ticket = await this.ticketModel.create({
      subject,
      description: dto.description,
      type: TicketType.LOST_ITEM,
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
      customerId: new Types.ObjectId(customerId),
      customerEmail: user?.email,
      orderId: order._id,
      missingItems: dto.missingItems ?? [],
      investigationStage: LostItemStage.COMPLAINT,
      outcome: TicketOutcome.PENDING,
      timeline: [
        {
          stage: LostItemStage.COMPLAINT,
          label: 'Customer complaint filed',
          at: new Date(),
          note: dto.missingItems?.length
            ? `Missing: ${dto.missingItems.join(', ')}`
            : undefined,
        },
      ],
    });

    return { success: true, data: this.serializeTicketForCustomer(ticket) };
  }

  async createAreaCoverageRequest(customerId: string, dto: CreateAreaRequestDto) {
    const addressRes = await this.addressesService.findAll(customerId);
    const address = addressRes.data.find((a) => a._id.toString() === dto.addressId);
    if (!address) throw new NotFoundException('Address not found');

    const existing = await this.ticketModel.findOne({
      customerId: new Types.ObjectId(customerId),
      type: TicketType.AREA_COVERAGE,
      status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
    });
    if (existing) {
      return {
        success: true,
        data: this.serializeTicketForCustomer(existing),
        message: 'We already received your pickup area request and will contact you soon.',
      };
    }

    const user = await this.userModel.findById(customerId).select('email phone');
    const addressLine = `${address.line1}, ${address.city}, ${address.province} ${address.postalCode}`;
    const gps =
      address.latitude != null && address.longitude != null
        ? `GPS: ${address.latitude}, ${address.longitude}`
        : null;
    const customerNote = dto.message?.trim() ? `Customer note: ${dto.message.trim()}` : null;

    const ticket = await this.ticketModel.create({
      subject: `Pickup not available — ${address.city}`,
      description: [
        'Customer could not schedule pickup for this address during booking.',
        `Address: ${addressLine}`,
        gps,
        customerNote,
        `Address ID: ${dto.addressId}`,
      ]
        .filter(Boolean)
        .join('\n'),
      type: TicketType.AREA_COVERAGE,
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      customerId: new Types.ObjectId(customerId),
      customerEmail: user?.email,
      timeline: [
        {
          stage: 'area_request',
          label: 'Pickup area request submitted',
          at: new Date(),
        },
      ],
    });

    return {
      success: true,
      data: this.serializeTicketForCustomer(ticket),
      message: 'Thanks — our team will review your address and follow up.',
    };
  }

  async listCustomerTickets(customerId: string) {
    const items = await this.ticketModel
      .find({ customerId: new Types.ObjectId(customerId) })
      .sort({ updatedAt: -1 })
      .limit(50);
    return {
      success: true,
      data: items.map((t) => this.serializeTicketForCustomer(t)),
    };
  }

  async getCustomerTicket(customerId: string, ticketId: string) {
    const ticket = await this.ticketModel.findById(ticketId);
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.customerId?.toString() !== customerId) {
      throw new ForbiddenException('Access denied');
    }
    const investigation =
      ticket.type === TicketType.LOST_ITEM
        ? await this.buildCustomerInvestigationView(ticket)
        : null;
    return {
      success: true,
      data: { ticket: this.serializeTicketForCustomer(ticket), investigation },
    };
  }

  async getTickets(status?: string, type?: string) {
    await this.ensureSeeded();
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    const [items, open, inProgress, resolved, closed, lostItem, total] = await Promise.all([
      this.ticketModel.find(filter).sort({ updatedAt: -1 }).limit(100),
      this.ticketModel.countDocuments({ status: TicketStatus.OPEN }),
      this.ticketModel.countDocuments({ status: TicketStatus.IN_PROGRESS }),
      this.ticketModel.countDocuments({ status: TicketStatus.RESOLVED }),
      this.ticketModel.countDocuments({ status: TicketStatus.CLOSED }),
      this.ticketModel.countDocuments({ type: TicketType.LOST_ITEM }),
      this.ticketModel.countDocuments({}),
    ]);
    return {
      success: true,
      data: {
        items: items.map((t) => this.serializeTicket(t)),
        counts: { open, inProgress, resolved, closed, lostItem, total },
      },
    };
  }

  async getTicket(id: string) {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket not found');
    return { success: true, data: this.serializeTicket(ticket) };
  }

  async getInvestigation(ticketId: string) {
    const ticket = await this.ticketModel.findById(ticketId);
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.type !== TicketType.LOST_ITEM) {
      throw new BadRequestException('Investigation is only for lost-item tickets');
    }

    const order = ticket.orderId
      ? await this.orderModel.findById(ticket.orderId)
      : null;

    return {
      success: true,
      data: {
        ticket: this.serializeTicket(ticket),
        flow: LOST_ITEM_FLOW,
        order: order ? this.serializeOrderSummary(order) : null,
        photos: order ? this.collectOrderPhotos(order) : [],
        laundryLogs: order ? this.buildLaundryLogs(order) : [],
      },
    };
  }

  async advanceInvestigation(ticketId: string, dto: InvestigateTicketDto) {
    const ticket = await this.ticketModel.findById(ticketId);
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.type !== TicketType.LOST_ITEM) {
      throw new BadRequestException('Investigation is only for lost-item tickets');
    }
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Ticket is already closed');
    }

    const pushTimeline = (stage: string, label: string, note?: string) => {
      ticket.timeline.push({ stage, label, at: new Date(), note });
    };

    switch (dto.action) {
      case InvestigateAction.START:
        ticket.status = TicketStatus.IN_PROGRESS;
        ticket.investigationStage = LostItemStage.INVESTIGATION;
        pushTimeline('investigation', 'Investigation started', dto.adminNote);
        break;

      case InvestigateAction.REVIEW_PHOTOS:
        if (!ticket.investigationStage || ticket.investigationStage === LostItemStage.COMPLAINT) {
          ticket.status = TicketStatus.IN_PROGRESS;
          if (ticket.investigationStage === LostItemStage.COMPLAINT) {
            ticket.investigationStage = LostItemStage.INVESTIGATION;
          }
        }
        ticket.photosReviewedAt = new Date();
        ticket.investigationStage = LostItemStage.PHOTOS_REVIEWED;
        pushTimeline('photos_reviewed', 'Photos reviewed', dto.adminNote);
        break;

      case InvestigateAction.REVIEW_LOGS:
        ticket.logsReviewedAt = new Date();
        ticket.investigationStage = LostItemStage.LOGS_REVIEWED;
        pushTimeline('logs_reviewed', 'Laundry logs reviewed', dto.adminNote);
        break;

      case InvestigateAction.DETERMINE_OUTCOME:
        if (!dto.outcome) {
          throw new BadRequestException('Outcome is required');
        }
        ticket.outcome = dto.outcome;
        ticket.outcomeNotes = dto.outcomeNotes;
        ticket.investigationStage = LostItemStage.OUTCOME;
        if (dto.compensationAmount != null) {
          ticket.compensationAmount = dto.compensationAmount;
        }
        pushTimeline(
          'outcome',
          `Outcome: ${dto.outcome}`,
          dto.outcomeNotes ?? dto.adminNote,
        );
        break;

      case InvestigateAction.COMPENSATE:
        if (
          ticket.outcome !== TicketOutcome.COMPENSATED &&
          dto.outcome !== TicketOutcome.COMPENSATED
        ) {
          throw new BadRequestException('Set outcome to compensated before crediting wallet');
        }
        const amount = dto.compensationAmount ?? ticket.compensationAmount;
        if (!amount || amount <= 0) {
          throw new BadRequestException('Compensation amount must be greater than zero');
        }
        if (!ticket.customerId) {
          throw new BadRequestException('Ticket has no customer linked for compensation');
        }
        if (ticket.compensationCreditedAt) {
          throw new BadRequestException('Compensation already credited');
        }
        ticket.outcome = TicketOutcome.COMPENSATED;
        ticket.compensationAmount = amount;
        await this.walletsService.credit(
          ticket.customerId.toString(),
          amount,
          `lost-item-${ticket._id}`,
          `Lost item compensation — ticket ${ticket._id.toString().slice(-6)}`,
        );
        ticket.compensationCreditedAt = new Date();
        ticket.investigationStage = LostItemStage.COMPENSATION;
        ticket.status = TicketStatus.RESOLVED;
        await this.ledgerService.post(
          `lost-item-${ticket._id.toString()}`,
          'refund',
          ticket._id.toString(),
          [
            {
              accountType: 'refund_expense',
              direction: 'debit',
              amount,
              description: `Lost item compensation — ticket ${ticket._id.toString().slice(-6)}`,
            },
            {
              accountType: 'customer_wallet_liability',
              accountSubject: ticket.customerId.toString(),
              direction: 'credit',
              amount,
              description: `Compensation credited to wallet for ticket ${ticket._id.toString().slice(-6)}`,
            },
          ],
        );
        pushTimeline('compensation', `₱${amount} credited to wallet`, dto.adminNote);
        break;

      case InvestigateAction.CLOSE:
        ticket.status = TicketStatus.CLOSED;
        ticket.investigationStage = LostItemStage.CLOSED;
        if (dto.adminNote) ticket.adminNote = dto.adminNote;
        pushTimeline('closed', 'Ticket closed', dto.adminNote);
        break;

      default:
        throw new BadRequestException('Unknown investigation action');
    }

    if (dto.adminNote && dto.action !== InvestigateAction.CLOSE) {
      ticket.adminNote = dto.adminNote;
    }
    await ticket.save();
    return this.getInvestigation(ticketId);
  }

  async updateTicket(id: string, dto: UpdateTicketDto) {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (dto.status) ticket.status = dto.status;
    if (dto.priority) ticket.priority = dto.priority;
    if (dto.adminNote != null) ticket.adminNote = dto.adminNote;
    await ticket.save();
    return { success: true, data: this.serializeTicket(ticket) };
  }

  private async buildCustomerInvestigationView(ticket: SupportTicketDocument) {
    return {
      flow: LOST_ITEM_FLOW,
      currentStage: ticket.investigationStage ?? LostItemStage.COMPLAINT,
      timeline: ticket.timeline,
      outcome: ticket.outcome,
      compensationAmount: ticket.compensationAmount,
      compensationCreditedAt: ticket.compensationCreditedAt,
    };
  }

  private collectOrderPhotos(order: OrderDocument) {
    const photos: { source: string; label: string; url: string; at?: Date }[] = [];
    if (order.pickup?.photoUrl) {
      photos.push({
        source: 'pickup',
        label: 'Pickup collection photo',
        url: order.pickup.photoUrl,
        at: order.pickup.collectedAt,
      });
    }
    if (order.delivery?.photoUrl) {
      photos.push({
        source: 'delivery',
        label: 'Delivery photo',
        url: order.delivery.photoUrl,
        at: order.delivery.deliveredAt,
      });
    }
    for (const step of order.laundryProcessing?.completedSteps ?? []) {
      if (step.photoUrl) {
        const meta = getProcessingStep(step.stepId as import('@lunara/utils').LaundryProcessingStepId);
        photos.push({
          source: 'processing',
          label: meta?.label ?? step.stepId,
          url: step.photoUrl,
          at: step.completedAt,
        });
      }
    }
    return photos;
  }

  private buildLaundryLogs(order: OrderDocument) {
    const logs: {
      kind: string;
      label: string;
      at?: Date;
      note?: string;
      verifiedWeightKg?: number;
      photoUrl?: string;
    }[] = [];

    for (const step of order.laundryProcessing?.completedSteps ?? []) {
      const meta = getProcessingStep(step.stepId as import('@lunara/utils').LaundryProcessingStepId);
      logs.push({
        kind: 'processing_step',
        label: meta?.label ?? step.stepId,
        at: step.completedAt,
        note: step.note,
        verifiedWeightKg: step.verifiedWeightKg,
        photoUrl: step.photoUrl,
      });
    }

    for (const ev of order.statusHistory ?? []) {
      logs.push({
        kind: 'status',
        label: ev.status.replace(/_/g, ' '),
        at: ev.timestamp,
        note: ev.note,
      });
    }

    if (order.laundryProcessing?.currentStepId) {
      const current = getProcessingStep(
        order.laundryProcessing.currentStepId as import('@lunara/utils').LaundryProcessingStepId,
      );
      logs.push({
        kind: 'current_step',
        label: `Current: ${current?.label ?? order.laundryProcessing.currentStepId}`,
        note: order.laundryProcessing.verifiedWeightKg
          ? `Verified weight ${order.laundryProcessing.verifiedWeightKg} kg`
          : undefined,
      });
    }

    return logs.sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : 0;
      const tb = b.at ? new Date(b.at).getTime() : 0;
      return ta - tb;
    });
  }

  private serializeOrderSummary(order: OrderDocument) {
    return {
      _id: order._id.toString(),
      status: order.status,
      bookingType: order.bookingType,
      total: order.total,
      estimatedWeightKg: order.estimatedWeightKg,
      verifiedWeightKg: order.laundryProcessing?.verifiedWeightKg,
      shelfSlot: order.laundryProcessing?.shelfSlot,
      pickupReceipt: order.pickup?.receiptCode,
      deliveryReceipt: order.delivery?.receiptCode,
      processingStepsTotal: LAUNDRY_PROCESSING_STEPS.length,
      processingStepsCompleted: order.laundryProcessing?.completedSteps?.length ?? 0,
    };
  }

  /**
   * Customer-facing serialization. Omits internal-only fields (staff adminNote,
   * riderId, photo/log review timestamps) and strips the `note` text from
   * timeline entries that were authored by staff during investigation
   * (investigation/photos_reviewed/logs_reviewed/outcome/compensation/closed),
   * since those notes are free-text meant for internal review, not customers.
   * Customer-authored stages (submitted/complaint/area_request) keep their note.
   */
  private static readonly CUSTOMER_VISIBLE_NOTE_STAGES = new Set([
    'submitted',
    'complaint',
    'area_request',
  ]);

  serializeTicketForCustomer(t: SupportTicketDocument) {
    const { customerId, riderId, adminNote, photosReviewedAt, logsReviewedAt, timeline, ...rest } =
      this.serializeTicket(t);
    void customerId;
    void riderId;
    void adminNote;
    void photosReviewedAt;
    void logsReviewedAt;
    return {
      ...rest,
      timeline: timeline.map((entry) =>
        SupportService.CUSTOMER_VISIBLE_NOTE_STAGES.has(entry.stage)
          ? entry
          : { ...entry, note: undefined },
      ),
    };
  }

  /**
   * Rider-facing serialization. Omits internal-only fields (staff adminNote,
   * customerId, photo/log review timestamps) and strips the `note` text from
   * timeline entries authored by staff during lost-item investigation, mirroring
   * serializeTicketForCustomer above. Rider-authored stages keep their note.
   */
  private static readonly RIDER_VISIBLE_NOTE_STAGES = new Set(['submitted']);

  serializeTicketForRider(t: SupportTicketDocument) {
    const { customerId, customerEmail, adminNote, photosReviewedAt, logsReviewedAt, timeline, ...rest } =
      this.serializeTicket(t);
    void customerId;
    void customerEmail;
    void adminNote;
    void photosReviewedAt;
    void logsReviewedAt;
    return {
      ...rest,
      timeline: timeline.map((entry) =>
        SupportService.RIDER_VISIBLE_NOTE_STAGES.has(entry.stage)
          ? entry
          : { ...entry, note: undefined },
      ),
    };
  }

  serializeTicket(t: SupportTicketDocument) {
    return {
      _id: t._id.toString(),
      subject: t.subject,
      description: t.description,
      status: t.status,
      priority: t.priority,
      type: t.type,
      customerEmail: t.customerEmail,
      customerId: t.customerId?.toString(),
      riderId: t.riderId?.toString(),
      orderId: t.orderId?.toString(),
      missingItems: t.missingItems,
      investigationStage: t.investigationStage,
      photosReviewedAt: t.photosReviewedAt,
      logsReviewedAt: t.logsReviewedAt,
      outcome: t.outcome,
      outcomeNotes: t.outcomeNotes,
      compensationAmount: t.compensationAmount,
      compensationCreditedAt: t.compensationCreditedAt,
      adminNote: t.adminNote,
      timeline: t.timeline,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }
}
