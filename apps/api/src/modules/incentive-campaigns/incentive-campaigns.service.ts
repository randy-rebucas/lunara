import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus, UserRole } from '@lunara/types';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RidersService } from '../riders/riders.service';
import { CampaignCredit, CampaignCreditDocument } from './schemas/campaign-credit.schema';
import { IncentiveCampaign, IncentiveCampaignDocument } from './schemas/incentive-campaign.schema';
import { CreateIncentiveCampaignDto, UpdateIncentiveCampaignDto } from './dto/incentive-campaign.dto';

const COMPLETED_STATUSES = [OrderStatus.DELIVERED, OrderStatus.COMPLETED];

@Injectable()
export class IncentiveCampaignsService {
  private readonly logger = new Logger(IncentiveCampaignsService.name);

  constructor(
    @InjectModel(IncentiveCampaign.name) private campaignModel: Model<IncentiveCampaignDocument>,
    @InjectModel(CampaignCredit.name) private creditModel: Model<CampaignCreditDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly ridersService: RidersService,
  ) {}

  async adminCreate(dto: CreateIncentiveCampaignDto) {
    const campaign = await this.campaignModel.create({
      title: dto.title.trim(),
      description: dto.description?.trim(),
      bonusAmount: dto.bonusAmount,
      thresholdDeliveries: dto.thresholdDeliveries,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      isActive: true,
    });
    return { success: true, data: campaign };
  }

  async adminList() {
    const items = await this.campaignModel.find().sort({ createdAt: -1 });
    return { success: true, data: items };
  }

  async adminUpdate(id: string, dto: UpdateIncentiveCampaignDto) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (dto.isActive !== undefined) campaign.isActive = dto.isActive;
    await campaign.save();
    return { success: true, data: campaign };
  }

  private async countDeliveries(riderId: string, startsAt: Date, endsAt: Date) {
    return this.orderModel.countDocuments({
      deliveryRiderId: new Types.ObjectId(riderId),
      status: { $in: COMPLETED_STATUSES },
      updatedAt: { $gte: startsAt, $lte: endsAt },
    });
  }

  /** Active campaigns overlapping now, with this rider's current delivery count in-window and
   * whether they've already been credited — for the rider-mobile "Incentives" view. */
  async listForRider(riderId: string) {
    const now = new Date();
    const campaigns = await this.campaignModel
      .find({ isActive: true, startsAt: { $lte: now }, endsAt: { $gte: now } })
      .sort({ endsAt: 1 });

    const data = await Promise.all(
      campaigns.map(async (c) => {
        const [deliveryCount, credited] = await Promise.all([
          this.countDeliveries(riderId, c.startsAt, c.endsAt),
          this.creditModel.exists({ campaignId: c._id, riderId: new Types.ObjectId(riderId) }),
        ]);
        return {
          _id: c._id.toString(),
          title: c.title,
          description: c.description,
          bonusAmount: c.bonusAmount,
          thresholdDeliveries: c.thresholdDeliveries,
          startsAt: c.startsAt.toISOString(),
          endsAt: c.endsAt.toISOString(),
          deliveryCount,
          credited: Boolean(credited),
        };
      }),
    );

    return { success: true, data };
  }

  /** Daily sweep: for every active campaign still within its window, credit the bonus to any
   * rider who has reached the delivery threshold and hasn't already been credited for it. */
  async sweepAndCreditEligibleRiders() {
    const now = new Date();
    const campaigns = await this.campaignModel.find({
      isActive: true,
      startsAt: { $lte: now },
      endsAt: { $gte: now },
    });
    if (campaigns.length === 0) return;

    const riders = await this.userModel.find({ role: UserRole.RIDER }).select('_id');

    for (const campaign of campaigns) {
      for (const rider of riders) {
        const riderId = rider._id.toString();
        const alreadyCredited = await this.creditModel.exists({
          campaignId: campaign._id,
          riderId: rider._id,
        });
        if (alreadyCredited) continue;

        const deliveryCount = await this.countDeliveries(riderId, campaign.startsAt, campaign.endsAt);
        if (deliveryCount < campaign.thresholdDeliveries) continue;

        try {
          await this.ridersService.creditManualEarning(
            riderId,
            'bonus',
            campaign.bonusAmount,
            `Incentive: ${campaign.title}`,
          );
          await this.creditModel.create({
            campaignId: campaign._id,
            riderId: rider._id,
            deliveryCountAtCredit: deliveryCount,
          });
        } catch (err) {
          this.logger.error(
            `Failed to credit campaign ${campaign._id.toString()} to rider ${riderId}: ${(err as Error).message}`,
          );
        }
      }
    }
  }
}
