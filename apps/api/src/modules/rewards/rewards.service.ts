import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { CustomerPromo, CustomerPromoDocument } from '../promotions/schemas/customer-promo.schema';
import { PointsTransaction, PointsTransactionDocument } from './schemas/points-transaction.schema';
import {
  POINTS_PER_COMPLETED_ORDER,
  REFERRAL_BONUS_POINTS,
  REWARD_VOUCHER_VALIDITY_DAYS,
  REWARDS_CATALOG,
  TIERS,
} from './rewards.catalog';

const VOUCHER_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class RewardsService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(CustomerPromo.name) private customerPromoModel: Model<CustomerPromoDocument>,
    @InjectModel(PointsTransaction.name)
    private pointsTransactionModel: Model<PointsTransactionDocument>,
  ) {}

  private isDuplicateKeyError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
  }

  private getTierProgress(points: number) {
    let current: (typeof TIERS)[number] = TIERS[0];
    for (const tier of TIERS) {
      if (points >= tier.min) current = tier;
    }
    const next = TIERS[TIERS.indexOf(current) + 1];
    return {
      tier: current.name,
      nextTier: next?.name ?? null,
      pointsToNextTier: next ? Math.max(0, next.min - points) : 0,
    };
  }

  async creditPoints(
    userId: string,
    amount: number,
    reference: string,
    description: string,
    sourceType: 'order' | 'referral' | 'redemption',
  ) {
    const userObjectId = new Types.ObjectId(userId);

    try {
      await this.pointsTransactionModel.create({
        userId: userObjectId,
        type: 'credit',
        amount,
        reference,
        description,
        sourceType,
      });
    } catch (err) {
      if (this.isDuplicateKeyError(err)) return;
      throw err;
    }

    await this.customerModel.updateOne(
      { userId: userObjectId },
      { $inc: { loyaltyPoints: amount } },
    );
  }

  async creditForOrderCompletion(orderId: string, customerId: string) {
    await this.creditPoints(
      customerId,
      POINTS_PER_COMPLETED_ORDER,
      `order-complete-${orderId}`,
      `Earned from completed order`,
      'order',
    );
  }

  async creditReferralBonus(referrerUserId: string, referredCustomerId: string) {
    await this.creditPoints(
      referrerUserId,
      REFERRAL_BONUS_POINTS,
      `referral-${referredCustomerId}`,
      'Earned from a successful referral',
      'referral',
    );
  }

  /**
   * Awards the referrer once the referred customer's first order completes.
   * No-op if the referred customer wasn't referred, or already has a completed order
   * (checked by the caller passing isFirstCompletedOrder).
   */
  async maybeCreditReferralForFirstOrder(referredCustomerId: string, isFirstCompletedOrder: boolean) {
    if (!isFirstCompletedOrder) return;
    const customer = await this.customerModel.findById(referredCustomerId);
    if (!customer?.referredBy) return;

    const referrer = await this.customerModel.findById(customer.referredBy);
    if (!referrer) return;

    await this.creditReferralBonus(referrer.userId.toString(), referredCustomerId);
  }

  async getReferralStats(userId: string) {
    const customer = await this.customerModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const [referredCount, pointsEarned] = await Promise.all([
      this.customerModel.countDocuments({ referredBy: customer._id }),
      this.pointsTransactionModel.aggregate<{ total: number }>([
        { $match: { userId: customer.userId, sourceType: 'referral' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    return {
      success: true,
      data: {
        referredCount,
        pointsEarned: pointsEarned[0]?.total ?? 0,
      },
    };
  }

  async getBalanceAndHistory(userId: string) {
    const customer = await this.customerModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const transactions = await this.pointsTransactionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50);

    return {
      success: true,
      data: {
        balance: customer.loyaltyPoints,
        ...this.getTierProgress(customer.loyaltyPoints),
        transactions,
      },
    };
  }

  getCatalog() {
    return { success: true, data: REWARDS_CATALOG };
  }

  async redeem(userId: string, catalogItemId: string) {
    const item = REWARDS_CATALOG.find((entry) => entry.id === catalogItemId);
    if (!item) throw new NotFoundException('Reward not found');

    const customer = await this.customerModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), loyaltyPoints: { $gte: item.points } },
      { $inc: { loyaltyPoints: -item.points } },
      { new: true },
    );
    if (!customer) throw new BadRequestException('Not enough points to redeem this reward');

    await this.pointsTransactionModel.create({
      userId: new Types.ObjectId(userId),
      type: 'debit',
      amount: item.points,
      reference: `redeem-${userId}-${item.id}-${Date.now()}`,
      description: `Redeemed for ${item.title}`,
      sourceType: 'redemption',
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REWARD_VOUCHER_VALIDITY_DAYS);

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = this.generateVoucherCode();
      try {
        const voucher = await this.customerPromoModel.create({
          userId: new Types.ObjectId(userId),
          code,
          title: item.title,
          description: item.description,
          discountType: item.discountType,
          discountValue: item.discountValue,
          expiresAt,
        });
        return { success: true, data: { voucher, balance: customer.loyaltyPoints } };
      } catch (err) {
        if (!this.isDuplicateKeyError(err)) throw err;
      }
    }
    throw new BadRequestException('Could not generate a voucher code, please try again');
  }

  private generateVoucherCode(): string {
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += VOUCHER_CODE_CHARS[Math.floor(Math.random() * VOUCHER_CODE_CHARS.length)];
    }
    return `RWD${suffix}`;
  }

  async getOrCreateReferralCode(userId: string) {
    const customer = await this.customerModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!customer) throw new NotFoundException('Customer profile not found');
    if (customer.referralCode) return { success: true, data: { referralCode: customer.referralCode } };

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = this.generateReferralCode();
      try {
        customer.referralCode = code;
        await customer.save();
        return { success: true, data: { referralCode: code } };
      } catch (err) {
        if (!this.isDuplicateKeyError(err)) throw err;
      }
    }
    throw new BadRequestException('Could not generate a referral code, please try again');
  }

  private generateReferralCode(): string {
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += VOUCHER_CODE_CHARS[Math.floor(Math.random() * VOUCHER_CODE_CHARS.length)];
    }
    return `REF${suffix}`;
  }

  async resolveReferrerByCode(referralCode: string) {
    return this.customerModel.findOne({ referralCode: referralCode.toUpperCase() });
  }
}
