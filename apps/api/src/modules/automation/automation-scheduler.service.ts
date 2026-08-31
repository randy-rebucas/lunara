import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus, UserRole } from '@lunara/types';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import { PartnerInvoice, PartnerInvoiceDocument } from '../partner/schemas/partner-invoice.schema';
import { SettingsService } from '../settings/settings.service';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
import { PartnerOperationsService } from '../partner/partner-operations.service';
import { AuditLogService } from '../audit/audit-log.service';
import { EmailService } from '../../common/email/email.service';
import { TwilioSmsService } from '../../common/sms/twilio-sms.service';
import { SubscriptionService } from '../billing/subscription.service';
import { SubscriptionStatus } from '../billing/schemas/subscription.schema';
import { NotificationDispatchService } from '../push/notification-dispatch.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const COMPLETED_STATUSES = [OrderStatus.DELIVERED, OrderStatus.COMPLETED];

/**
 * Periodic sweep that performs the automations an admin has toggled on in Automation Settings.
 * Every check re-reads the flag from settingsService so toggling off takes effect on the next run
 * without a redeploy, and each action mirrors exactly what the manual admin endpoint already does.
 */
@Injectable()
export class AutomationSchedulerService {
  private readonly logger = new Logger(AutomationSchedulerService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(PartnerInvoice.name) private invoiceModel: Model<PartnerInvoiceDocument>,
    private settingsService: SettingsService,
    private riderAssignmentService: RiderAssignmentService,
    private partnerOperationsService: PartnerOperationsService,
    private auditLogService: AuditLogService,
    private emailService: EmailService,
    private twilioSmsService: TwilioSmsService,
    private subscriptionService: SubscriptionService,
    private notificationDispatchService: NotificationDispatchService,
  ) {}

  private async recordAutomationAction(action: string, path: string, requestBody: unknown) {
    const systemAdmin = await this.userModel.findOne({ role: UserRole.ADMIN });
    if (!systemAdmin) return;
    await this.auditLogService.record({
      actorUserId: systemAdmin._id.toString(),
      actorEmail: systemAdmin.email ?? 'system@automation',
      actorRole: 'system',
      method: 'AUTOMATION',
      path,
      action,
      statusCode: 200,
      requestBody,
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sweepRiderAssignments() {
    const [autoPickup, autoDelivery] = await Promise.all([
      this.settingsService.isAutomationEnabled('autoAssignPickupRider'),
      this.settingsService.isAutomationEnabled('autoAssignDeliveryRider'),
    ]);

    if (autoPickup) {
      const pending = await this.orderModel
        .find({
          dispatchStatus: 'dispatched',
          partnerAcceptedAt: { $exists: true },
          pickupRiderId: { $exists: false },
          status: { $in: [OrderStatus.SHOP_ASSIGNED, OrderStatus.CONFIRMED] },
        })
        .limit(25);

      for (const order of pending) {
        try {
          await this.riderAssignmentService.confirmSuggestedPickupRider(order._id.toString(), '');
          await this.recordAutomationAction(
            'automation.order.auto_pickup_rider_assigned',
            `/admin/orders/${order._id.toString()}`,
            { orderId: order._id.toString() },
          );
        } catch (err) {
          this.logger.warn(`Auto pickup-rider assignment skipped for order ${order._id}: ${(err as Error).message}`);
        }
      }
    }

    if (autoDelivery) {
      const pending = await this.orderModel
        .find({ status: OrderStatus.READY_FOR_DELIVERY, deliveryRiderId: { $exists: false } })
        .limit(25);

      for (const order of pending) {
        try {
          await this.riderAssignmentService.confirmSuggestedDeliveryRider(order._id.toString(), '');
          await this.recordAutomationAction(
            'automation.order.auto_delivery_rider_assigned',
            `/admin/orders/${order._id.toString()}`,
            { orderId: order._id.toString() },
          );
        } catch (err) {
          this.logger.warn(`Auto delivery-rider assignment skipped for order ${order._id}: ${(err as Error).message}`);
        }
      }
    }
  }

  /** Weekly invoice generation for every partner branch with uninvoiced completed orders. */
  @Cron(CronExpression.EVERY_WEEK)
  async generateScheduledInvoices() {
    if (!(await this.settingsService.isAutomationEnabled('autoGenerateInvoices'))) return;

    const systemAdmin = await this.userModel.findOne({ role: UserRole.ADMIN });
    if (!systemAdmin) {
      this.logger.warn('Auto-invoicing skipped: no admin user found to attribute invoices to');
      return;
    }

    const branches = await this.branchModel.find({ branchType: 'partner_shop' });
    // A partner can own several branches, but the subscription fee is billed once per partner —
    // track which partners already got an invoice (order-based or subscription-only) this run.
    const invoicedPartnerIds = new Set<string>();
    for (const branch of branches) {
      const partnerId = branch.partnerUserId.toString();
      try {
        const uninvoiced = await this.partnerOperationsService.getUninvoicedOrders(partnerId);
        const orderIds = uninvoiced.data.map((o: { orderId: string }) => o.orderId);

        if (orderIds.length === 0) {
          if (invoicedPartnerIds.has(partnerId)) continue;
          const feeDue = await this.partnerOperationsService.isSubscriptionFeeDue(partnerId);
          if (!feeDue) continue;
        }

        await this.partnerOperationsService.createInvoice(
          systemAdmin._id.toString(),
          partnerId,
          { orderIds, adminNote: 'Auto-generated by scheduled automation' },
        );
        invoicedPartnerIds.add(partnerId);
        await this.recordAutomationAction(
          'automation.invoice.auto_generated',
          `/admin/partners/${partnerId}/invoices`,
          { branchId: branch._id.toString(), orderCount: orderIds.length },
        );
      } catch (err) {
        this.logger.warn(`Auto-invoicing skipped for branch ${branch._id}: ${(err as Error).message}`);
      }
    }
  }

  private static readonly DUNNING_NOTICES: Record<
    Extract<SubscriptionStatus, 'past_due' | 'grace_period' | 'suspended'>,
    { title: string; body: (invoiceNumber: string) => string }
  > = {
    past_due: {
      title: 'Payment past due',
      body: (n) => `Your subscription invoice ${n} is past due. Please settle it to avoid a service interruption.`,
    },
    grace_period: {
      title: 'Account in grace period',
      body: (n) => `Invoice ${n} is still unpaid. Your account will be suspended soon if it isn't settled.`,
    },
    suspended: {
      title: 'Account suspended',
      body: (n) => `Invoice ${n} remains unpaid. New orders and staff are on hold until it's settled.`,
    },
  };

  /** Daily dunning sweep: escalates overdue subscription invoices through
   * past_due -> grace_period -> suspended, retrying a saved-card auto-charge at each step
   * before advancing the stage. Never lets one partner's failure abort the sweep. */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async sweepDunning() {
    if (!(await this.settingsService.isAutomationEnabled('autoDunningEnabled'))) return;
    const { gracePeriodDays, suspendAfterGraceDays } = await this.settingsService.getDunningConfig();

    const overdueInvoices = await this.invoiceModel.find({
      status: 'pending',
      subscriptionFeeDue: { $gt: 0 },
      dueDate: { $lt: new Date() },
    });

    const now = Date.now();
    for (const invoice of overdueInvoices) {
      const partnerId = invoice.partnerId.toString();
      try {
        const subscription = await this.subscriptionService.findByPartnerId(partnerId);
        if (!subscription) continue;
        if (subscription.status === 'cancelled' || subscription.status === 'expired') continue;

        const daysOverdue = (now - (invoice.dueDate ?? invoice.createdAt).getTime()) / DAY_MS;

        // Retry the saved card once per day while past_due/grace_period, before evaluating
        // whether to advance the dunning stage further.
        const alreadyAttemptedToday =
          subscription.lastDunningAttemptAt &&
          now - subscription.lastDunningAttemptAt.getTime() < DAY_MS;
        if (
          !alreadyAttemptedToday &&
          (subscription.status === 'past_due' || subscription.status === 'grace_period') &&
          subscription.paymentMethodOnFile
        ) {
          subscription.lastDunningAttemptAt = new Date();
          await subscription.save();
          const charge = await this.subscriptionService.attemptAutoCharge(
            subscription,
            invoice.subscriptionFeeDue,
            `Subscription dunning retry — invoice ${invoice.invoiceNumber}`,
          );
          if (charge.success) {
            const systemAdmin = await this.userModel.findOne({ role: UserRole.ADMIN });
            if (systemAdmin) {
              await this.partnerOperationsService.markInvoicePaid(systemAdmin._id.toString(), invoice._id.toString(), {
                paymentReference: charge.providerReference,
                note: 'Auto-charged via saved card (dunning retry)',
              });
            }
            continue; // markInvoicePaid already reactivates the subscription + notifies
          }
        }

        let nextStatus: 'past_due' | 'grace_period' | 'suspended' | null = null;
        if (subscription.status === 'active' && daysOverdue >= 0) {
          nextStatus = 'past_due';
        } else if (subscription.status === 'past_due' && daysOverdue >= gracePeriodDays) {
          nextStatus = 'grace_period';
        } else if (subscription.status === 'grace_period' && daysOverdue >= gracePeriodDays + suspendAfterGraceDays) {
          nextStatus = 'suspended';
        }
        if (!nextStatus) continue;

        await this.subscriptionService.transitionStatus(subscription, nextStatus);
        const notice = AutomationSchedulerService.DUNNING_NOTICES[nextStatus];
        await this.notificationDispatchService.dispatch({
          userId: partnerId,
          title: notice.title,
          body: notice.body(invoice.invoiceNumber),
          data: { type: `billing_${nextStatus}`, subscriptionId: (subscription._id as Types.ObjectId).toString() },
        });
        await this.recordAutomationAction(
          'automation.subscription.status_transitioned',
          `/admin/billing/subscriptions/${partnerId}`,
          { partnerId, invoiceId: invoice._id.toString(), newStatus: nextStatus, daysOverdue: Math.floor(daysOverdue) },
        );
      } catch (err) {
        this.logger.warn(`Dunning sweep skipped for partner ${partnerId}: ${(err as Error).message}`);
      }
    }
  }

  /** Weekly SMS + email platform stats sent to the admin contacts configured in Automation Settings.
   *  `force: true` (used by the manual "send now" admin endpoint) skips the enabled check so it can
   *  be tested without waiting for the weekly cron or flipping the toggle on first. */
  @Cron(CronExpression.EVERY_WEEK)
  async sendWeeklyStats(force = false) {
    const { enabled, phone, email } = await this.settingsService.getWeeklyStatsConfig();
    if (!enabled && !force) return;

    try {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);

      const [orders, newCustomers, ridersJoined] = await Promise.all([
        this.orderModel.find({ createdAt: { $gte: from } }).select('status total'),
        this.userModel.countDocuments({ role: UserRole.CUSTOMER, createdAt: { $gte: from } }),
        this.riderModel.countDocuments({ createdAt: { $gte: from } }),
      ]);
      const completed = orders.filter((o) => COMPLETED_STATUSES.includes(o.status));
      const cancelled = orders.filter((o) => o.status === OrderStatus.CANCELLED);
      const revenue = completed.reduce((sum, o) => sum + o.total, 0);

      const summary = {
        periodFrom: from.toISOString().slice(0, 10),
        totalOrders: orders.length,
        completedOrders: completed.length,
        cancelledOrders: cancelled.length,
        revenue,
        newCustomers,
        ridersJoined,
      };

      if (phone) {
        const text =
          `Lunara weekly stats (from ${summary.periodFrom}): ` +
          `${summary.totalOrders} orders, ${summary.completedOrders} completed, ` +
          `${summary.cancelledOrders} cancelled, ₱${summary.revenue} revenue, ` +
          `${summary.newCustomers} new customers, ${summary.ridersJoined} riders joined.`;
        await this.twilioSmsService.send(phone, text);
      }

      if (email) {
        await this.emailService.send({
          to: email,
          subject: `Lunara weekly stats — ${summary.periodFrom}`,
          text:
            `Weekly platform summary (7 days from ${summary.periodFrom}):\n\n` +
            `Total orders: ${summary.totalOrders}\n` +
            `Completed orders: ${summary.completedOrders}\n` +
            `Cancelled orders: ${summary.cancelledOrders}\n` +
            `Revenue: ₱${summary.revenue}\n` +
            `New customers: ${summary.newCustomers}\n` +
            `Riders joined: ${summary.ridersJoined}\n`,
        });
      }

      await this.recordAutomationAction('automation.weekly_stats.sent', '/admin/reports', summary);
    } catch (err) {
      this.logger.warn(`Weekly stats notification failed: ${(err as Error).message}`);
    }
  }
}
