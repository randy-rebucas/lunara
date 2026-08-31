import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { PushNotificationService } from '../push/push-notification.service';
import { PartnerCampaign, PartnerCampaignDocument } from './schemas/partner-campaign.schema';
import { SendCampaignDto } from './dto/send-campaign.dto';

@Injectable()
export class PartnerCampaignsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
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

  async sendCampaign(partnerUserId: string, dto: SendCampaignDto) {
    const customerIds = await this.resolveOwnCustomerIds(partnerUserId);
    if (customerIds.length === 0) {
      throw new BadRequestException('No customers to send to yet');
    }

    const sentCount = await this.pushNotificationService.sendToUsers(customerIds, {
      title: dto.title,
      body: dto.body,
    });

    await this.partnerCampaignModel.create({
      partnerUserId: new Types.ObjectId(partnerUserId),
      title: dto.title,
      body: dto.body,
      recipientCount: customerIds.length,
      sentCount,
    });

    return { success: true, data: { recipientCount: customerIds.length, sentCount } };
  }
}
