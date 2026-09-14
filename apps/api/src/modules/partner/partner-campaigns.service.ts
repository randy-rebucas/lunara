import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { PushNotificationService } from '../push/push-notification.service';
import { PartnerCampaign, PartnerCampaignDocument } from './schemas/partner-campaign.schema';
import { SendCampaignDto } from './dto/send-campaign.dto';

@Injectable()
export class PartnerCampaignsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(PartnerCampaign.name) private partnerCampaignModel: Model<PartnerCampaignDocument>,
    private pushNotificationService: PushNotificationService,
  ) {}

  async listCampaigns(partnerUserId: string) {
    const campaigns = await this.partnerCampaignModel
      .find({ partnerUserId: new Types.ObjectId(partnerUserId) })
      .sort({ createdAt: -1 })
      .limit(50);
    return { success: true, data: campaigns };
  }

  /** Distinct customer user-ids who've completed an order at this partner — same population as
   * PartnerController.getCustomers, just ids only (no name/spend join needed for a send). */
  private async resolveOwnCustomerIds(partnerUserId: string): Promise<string[]> {
    const rows = await this.orderModel.aggregate<{ _id: Types.ObjectId }>([
      {
        $match: {
          partnerId: new Types.ObjectId(partnerUserId),
          status: { $in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED, OrderStatus.CUSTOMER_PICKUP] },
        },
      },
      { $group: { _id: '$customerId' } },
    ]);
    return rows.map((r) => r._id.toString());
  }

  /** Marketing pushes must respect the same push opt-out customers use for order/rewards
   * notifications (Customer.notificationPreferences.push) — a partner campaign is not exempt
   * just because it's partner-initiated rather than system-initiated. */
  private async filterPushOptedIn(customerIds: string[]): Promise<string[]> {
    const optedOut = await this.customerModel
      .find({
        userId: { $in: customerIds.map((id) => new Types.ObjectId(id)) },
        'notificationPreferences.push': false,
      })
      .select('userId')
      .lean();
    const optedOutIds = new Set(optedOut.map((c) => c.userId.toString()));
    return customerIds.filter((id) => !optedOutIds.has(id));
  }

  async sendCampaign(partnerUserId: string, dto: SendCampaignDto) {
    const allCustomerIds = await this.resolveOwnCustomerIds(partnerUserId);
    if (allCustomerIds.length === 0) {
      throw new BadRequestException('No customers to send to yet');
    }
    const recipientIds = await this.filterPushOptedIn(allCustomerIds);
    if (recipientIds.length === 0) {
      throw new BadRequestException('All of your customers have opted out of push notifications');
    }

    const sentCount = await this.pushNotificationService.sendToUsers(recipientIds, {
      title: dto.title,
      body: dto.body,
    });

    await this.partnerCampaignModel.create({
      partnerUserId: new Types.ObjectId(partnerUserId),
      title: dto.title,
      body: dto.body,
      recipientCount: recipientIds.length,
      sentCount,
    });

    return { success: true, data: { recipientCount: recipientIds.length, sentCount } };
  }
}
