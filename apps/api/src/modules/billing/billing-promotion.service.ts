import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BillingPromotion, BillingPromotionDocument } from './schemas/billing-promotion.schema';
import { SubscriptionService } from './subscription.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

@Injectable()
export class BillingPromotionService {
  constructor(
    @InjectModel(BillingPromotion.name) private promoModel: Model<BillingPromotionDocument>,
    private subscriptionService: SubscriptionService,
  ) {}

  async list() {
    return this.promoModel.find().sort({ createdAt: -1 }).lean();
  }

  async create(dto: CreatePromotionDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.promoModel.findOne({ code });
    if (existing) throw new BadRequestException(`A promo with code "${code}" already exists`);
    return this.promoModel.create({
      ...dto,
      code,
      applicablePlanIds: (dto.applicablePlanIds ?? []).map((id) => new Types.ObjectId(id)),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  async update(id: string, dto: UpdatePromotionDto) {
    const promo = await this.promoModel.findByIdAndUpdate(id, dto, { new: true });
    if (!promo) throw new NotFoundException('Promotion not found');
    return promo;
  }

  /** Redeems a code against a partner's subscription — used both by an admin applying a promo
   * on a partner's behalf and by a partner self-redeeming from the Plan settings tab. */
  async redeem(partnerId: string, code: string) {
    const subscription = await this.subscriptionService.findByPartnerId(partnerId);
    if (!subscription) throw new NotFoundException('Subscription not found for this partner');

    const promo = await this.promoModel.findOne({ code: code.trim().toUpperCase() });
    if (!promo || !promo.isActive) throw new BadRequestException('Invalid or inactive promo code');
    if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Promo code has expired');
    }
    if (
      promo.applicablePlanIds.length > 0 &&
      !promo.applicablePlanIds.some((id) => id.equals(subscription.planId))
    ) {
      throw new BadRequestException('This promo code is not valid for your current plan');
    }

    // Atomic claim: only succeeds while under the cap, so concurrent redemptions can't oversell it.
    const claimed = await this.promoModel.findOneAndUpdate(
      { _id: promo._id, ...(promo.maxRedemptions ? { redemptionCount: { $lt: promo.maxRedemptions } } : {}) },
      { $inc: { redemptionCount: 1 } },
      { new: true },
    );
    if (!claimed) throw new BadRequestException('This promo code has reached its redemption limit');

    subscription.activePromotionId = promo._id as Types.ObjectId;
    subscription.promotionCode = promo.code;
    subscription.promotionDiscountType = promo.discountType;
    subscription.promotionDiscountValue = promo.discountValue;
    subscription.promotionFreeMonthsRemaining = promo.discountType === 'free_months' ? promo.discountValue : undefined;
    await subscription.save();
    return subscription;
  }

  async remove(partnerId: string) {
    const subscription = await this.subscriptionService.findByPartnerId(partnerId);
    if (!subscription) throw new NotFoundException('Subscription not found for this partner');

    subscription.activePromotionId = undefined;
    subscription.promotionCode = undefined;
    subscription.promotionDiscountType = undefined;
    subscription.promotionDiscountValue = undefined;
    subscription.promotionFreeMonthsRemaining = undefined;
    await subscription.save();
    return subscription;
  }
}
