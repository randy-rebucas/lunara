import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus, UserRole } from '@lunara/types';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import { SettingsService } from '../settings/settings.service';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
import { PartnerOperationsService } from '../partner/partner-operations.service';
import { AuditLogService } from '../audit/audit-log.service';
import { EmailService } from '../../common/email/email.service';
import { TwilioSmsService } from '../../common/sms/twilio-sms.service';

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
    private settingsService: SettingsService,
    private riderAssignmentService: RiderAssignmentService,
    private partnerOperationsService: PartnerOperationsService,
    private auditLogService: AuditLogService,
    private emailService: EmailService,
    private twilioSmsService: TwilioSmsService,
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

  /** Weekly settlement generation for every partner branch with unsettled completed orders. */
  @Cron(CronExpression.EVERY_WEEK)
  async generateScheduledSettlements() {
    if (!(await this.settingsService.isAutomationEnabled('autoGenerateSettlements'))) return;

    const systemAdmin = await this.userModel.findOne({ role: UserRole.ADMIN });
    if (!systemAdmin) {
      this.logger.warn('Auto-settlement skipped: no admin user found to attribute settlements to');
      return;
    }

    const branches = await this.branchModel.find({ branchType: 'partner_shop' });
    for (const branch of branches) {
      try {
        const unsettled = await this.partnerOperationsService.getUnsettledOrders(
          branch.partnerUserId.toString(),
        );
        const orderIds = unsettled.data.map((o) => o.orderId);
        if (orderIds.length === 0) continue;

        await this.partnerOperationsService.createSettlement(
          systemAdmin._id.toString(),
          branch.partnerUserId.toString(),
          { orderIds, adminNote: 'Auto-generated by scheduled automation' },
        );
        await this.recordAutomationAction(
          'automation.settlement.auto_generated',
          `/admin/partners/${branch.partnerUserId.toString()}/settlements`,
          { branchId: branch._id.toString(), orderCount: orderIds.length },
        );
      } catch (err) {
        this.logger.warn(`Auto-settlement skipped for branch ${branch._id}: ${(err as Error).message}`);
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
