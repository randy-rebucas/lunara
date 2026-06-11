import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus, PromotionAudience, PromotionKind } from '@lunara/types';
import {
  applyPromotionToQuote,
  generateSignupPromoCode,
  isNewCustomer,
  isPromotionActive,
  normalizePromotionCode,
  type QuoteBreakdown,
  validateCustomerPromoForQuote,
  validatePromotionForCustomer,
} from '@lunara/utils';
import { Promotion, PromotionDocument } from '../admin/schemas/promotion.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CustomerPromo, CustomerPromoDocument } from './schemas/customer-promo.schema';
import {
  PromotionRedemption,
  PromotionRedemptionDocument,
} from './schemas/promotion-redemption.schema';
import { DEFAULT_PROMOTIONS } from './promotions.seed';

const COMPLETED_ORDER_STATUSES = [OrderStatus.DELIVERED, OrderStatus.COMPLETED];

type ResolvedPromo =
  | {
      type: 'shared';
      promotion: PromotionDocument;
    }
  | {
      type: 'personal';
      customerPromo: CustomerPromoDocument;
    };

@Injectable()
export class PromotionsService {
  constructor(
    @InjectModel(Promotion.name) private promotionModel: Model<PromotionDocument>,
    @InjectModel(CustomerPromo.name) private customerPromoModel: Model<CustomerPromoDocument>,
    @InjectModel(PromotionRedemption.name)
    private promotionRedemptionModel: Model<PromotionRedemptionDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async ensureSeeded() {
    const promoCount = await this.promotionModel.countDocuments();
    if (promoCount === 0) await this.promotionModel.insertMany(DEFAULT_PROMOTIONS);
  }

  async reseedDefaults() {
    const now = new Date();
    for (const promo of DEFAULT_PROMOTIONS) {
      await this.promotionModel.updateOne(
        { code: promo.code },
        {
          $set: { ...promo, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
    }
  }

  async grantSignupPromo(userId: string) {
    await this.ensureSeeded();

    const existing = await this.customerPromoModel.findOne({
      userId: new Types.ObjectId(userId),
      redeemedAt: { $exists: false },
      expiresAt: { $gte: new Date() },
    });
    if (existing) return existing;

    const template = await this.promotionModel.findOne({
      kind: PromotionKind.SIGNUP_TEMPLATE,
      isActive: true,
    });
    if (!template) return null;

    const validityDays = template.newCustomerWithinDays ?? 14;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateSignupPromoCode();
      try {
        return await this.customerPromoModel.create({
          userId: new Types.ObjectId(userId),
          code,
          title: template.title,
          description: template.description,
          discountType: template.discountType,
          discountValue: template.discountValue,
          minOrderAmount: template.minOrderAmount,
          expiresAt,
          sourcePromotionId: template._id,
        });
      } catch {
        // retry on duplicate code
      }
    }

    return null;
  }

  private async countCompletedOrders(customerId: string) {
    return this.orderModel.countDocuments({
      customerId: new Types.ObjectId(customerId),
      status: { $in: COMPLETED_ORDER_STATUSES },
    });
  }

  private async countRedemptions(userId: string, promotionId: Types.ObjectId) {
    return this.promotionRedemptionModel.countDocuments({
      userId: new Types.ObjectId(userId),
      promotionId,
    });
  }

  private async buildCustomerContext(userId: string, subtotal: number) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const completedOrderCount = await this.countCompletedOrders(userId);
    return {
      subtotal,
      userCreatedAt: user.createdAt,
      completedOrderCount,
    };
  }

  private async resolveCode(code: string, userId: string): Promise<ResolvedPromo | null> {
    const normalized = normalizePromotionCode(code);
    if (!normalized) return null;

    const personal = await this.customerPromoModel.findOne({ code: normalized });
    if (personal) {
      if (personal.userId.toString() !== userId) {
        throw new BadRequestException('This promo code is not valid for your account');
      }
      return { type: 'personal', customerPromo: personal };
    }

    await this.ensureSeeded();
    const promotion = await this.promotionModel.findOne({ code: normalized });
    if (!promotion) return null;
    if (promotion.kind === PromotionKind.SIGNUP_TEMPLATE) {
      throw new BadRequestException('Invalid or expired promo code');
    }
    return { type: 'shared', promotion };
  }

  async applyCouponToQuote(
    quote: QuoteBreakdown,
    couponCode: string | undefined,
    userId: string,
  ): Promise<QuoteBreakdown> {
    if (!couponCode?.trim()) return quote;

    const resolved = await this.resolveCode(couponCode, userId);
    if (!resolved) {
      throw new BadRequestException('Invalid or expired promo code');
    }

    if (resolved.type === 'personal') {
      const promo = resolved.customerPromo;
      const eligibility = validateCustomerPromoForQuote(
        {
          code: promo.code,
          title: promo.title,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
          minOrderAmount: promo.minOrderAmount,
          expiresAt: promo.expiresAt,
          redeemedAt: promo.redeemedAt,
        },
        quote.subtotal,
      );
      if (!eligibility.valid) {
        throw new BadRequestException(eligibility.message);
      }
      return applyPromotionToQuote(quote, {
        code: promo.code,
        title: promo.title,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
      });
    }

    const promo = resolved.promotion;
    const context = await this.buildCustomerContext(userId, quote.subtotal);
    const redemptionCount = await this.countRedemptions(userId, promo._id);
    const eligibility = validatePromotionForCustomer(
      {
        code: promo.code,
        title: promo.title,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        minOrderAmount: promo.minOrderAmount,
        isActive: promo.isActive,
        startsAt: promo.startsAt,
        endsAt: promo.endsAt,
        audience: promo.audience,
        maxUsesPerCustomer: promo.maxUsesPerCustomer,
        newCustomerWithinDays: promo.newCustomerWithinDays,
      },
      { ...context, redemptionCount },
    );
    if (!eligibility.valid) {
      throw new BadRequestException(eligibility.message);
    }

    return applyPromotionToQuote(quote, {
      code: promo.code,
      title: promo.title,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
    });
  }

  async recordRedemption(userId: string, code: string, orderId: string) {
    const normalized = normalizePromotionCode(code);
    if (!normalized) return;

    const personal = await this.customerPromoModel.findOne({
      code: normalized,
      userId: new Types.ObjectId(userId),
    });
    if (personal) {
      if (!personal.redeemedAt) {
        personal.redeemedAt = new Date();
        personal.orderId = new Types.ObjectId(orderId);
        await personal.save();
      }
      return;
    }

    const promotion = await this.promotionModel.findOne({ code: normalized });
    if (!promotion) return;

    await this.promotionRedemptionModel.create({
      userId: new Types.ObjectId(userId),
      promotionId: promotion._id,
      orderId: new Types.ObjectId(orderId),
    });
  }

  private serializeDealFromPromotion(p: PromotionDocument) {
    return {
      _id: p._id.toString(),
      code: p.code,
      title: p.title,
      description: p.description,
      discountType: p.discountType,
      discountValue: p.discountValue,
      minOrderAmount: p.minOrderAmount,
      startsAt: p.startsAt?.toISOString(),
      endsAt: p.endsAt?.toISOString(),
      expiresAt: p.endsAt?.toISOString(),
      isPersonal: false,
      audience: p.audience,
    };
  }

  private serializeDealFromCustomerPromo(p: CustomerPromoDocument) {
    return {
      _id: p._id.toString(),
      code: p.code,
      title: p.title,
      description: p.description,
      discountType: p.discountType,
      discountValue: p.discountValue,
      minOrderAmount: p.minOrderAmount,
      startsAt: undefined,
      expiresAt: p.expiresAt.toISOString(),
      endsAt: p.expiresAt.toISOString(),
      isPersonal: true,
      audience: PromotionAudience.ALL,
    };
  }

  async listDealsForCustomer(userId: string) {
    await this.ensureSeeded();
    const now = new Date();
    const user = await this.userModel.findById(userId);
    if (!user) return [];

    const completedOrderCount = await this.countCompletedOrders(userId);
    const isEligibleNewCustomer = isNewCustomer(
      completedOrderCount,
      user.createdAt,
      undefined,
      now,
    );

    const shared = await this.promotionModel
      .find({
        kind: PromotionKind.STANDARD,
        isActive: true,
        $and: [
          { $or: [{ startsAt: { $exists: false } }, { startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gte: now } }] },
        ],
      })
      .sort({ createdAt: -1 });

    const deals = shared
      .filter((p) => {
        if (!isPromotionActive(p, now)) return false;
        if (p.audience === PromotionAudience.NEW_CUSTOMERS) {
          if (!isEligibleNewCustomer) return false;
          if (p.newCustomerWithinDays) {
            return isNewCustomer(
              completedOrderCount,
              user.createdAt,
              p.newCustomerWithinDays,
              now,
            );
          }
        }
        return true;
      })
      .map((p) => this.serializeDealFromPromotion(p));

    const personal = await this.customerPromoModel.findOne({
      userId: new Types.ObjectId(userId),
      redeemedAt: { $exists: false },
      expiresAt: { $gte: now },
    });
    if (personal) {
      deals.unshift(this.serializeDealFromCustomerPromo(personal));
    }

    return deals;
  }
}
