import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus, PromotionAudience, PromotionKind } from '@lunara/types';
import {
  applyPromotionToQuote,
  generateSignupPromoCode,
  isNewCustomer,
  isPromotionActive,
  normalizePromotionCode,
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
import {
  PromotionUsageCounter,
  PromotionUsageCounterDocument,
} from './schemas/promotion-usage-counter.schema';
import { DEFAULT_PROMOTIONS } from './promotions.seed';
import { CreatePartnerPromotionDto } from '../partner/dto/create-partner-promotion.dto';

const COMPLETED_ORDER_STATUSES = [OrderStatus.DELIVERED, OrderStatus.COMPLETED];

/** Ceilings on partner-created promotions — partners fund these themselves, but an unbounded
 * discount is still a support/abuse risk worth capping platform-side regardless of who pays. */
const MAX_PARTNER_PERCENT_DISCOUNT = 50;
const MAX_PARTNER_FIXED_DISCOUNT = 300;

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
export class PromotionsService implements OnModuleInit {
  constructor(
    @InjectModel(Promotion.name) private promotionModel: Model<PromotionDocument>,
    @InjectModel(CustomerPromo.name) private customerPromoModel: Model<CustomerPromoDocument>,
    @InjectModel(PromotionRedemption.name)
    private promotionRedemptionModel: Model<PromotionRedemptionDocument>,
    @InjectModel(PromotionUsageCounter.name)
    private usageCounterModel: Model<PromotionUsageCounterDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async onModuleInit() {
    await this.reseedDefaults();
  }

  async ensureSeeded() {
    const promoCount = await this.promotionModel.countDocuments();
    if (promoCount === 0) await this.promotionModel.insertMany(DEFAULT_PROMOTIONS);
  }

  async reseedDefaults() {
    const now = new Date();
    for (const promo of DEFAULT_PROMOTIONS) {
      // endsAt/startsAt only on insert — don't overwrite admin-edited schedules on restart
      const { endsAt, startsAt, ...coreFields } = promo as typeof promo & {
        endsAt?: Date;
        startsAt?: Date;
      };
      await this.promotionModel.updateOne(
        { code: promo.code },
        {
          $set: { ...coreFields, updatedAt: now },
          $setOnInsert: {
            createdAt: now,
            ...(startsAt != null ? { startsAt } : {}),
            ...(endsAt != null ? { endsAt } : {}),
          },
        },
        { upsert: true },
      );
    }
  }

  async grantSignupPromo(userId: string) {
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
    if (!user) throw new UnauthorizedException('Session expired. Please sign in again.');

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

    const promotion = await this.promotionModel.findOne({ code: normalized });
    if (!promotion) return null;
    if (promotion.kind === PromotionKind.SIGNUP_TEMPLATE) {
      throw new BadRequestException('Invalid or expired promo code');
    }
    return { type: 'shared', promotion };
  }

  /** `partnerId` is the resolved order's shop's owning partner (branch.partnerUserId) — required to
   * validate a partner-scoped promotion code, since those only apply to orders at that partner's
   * own branches. Platform (admin-created) promotions ignore it entirely. */
  async applyCouponToQuote<
    T extends { subtotal: number; deliveryFee: number; discount: number; total: number; couponCode?: string; promotionTitle?: string },
  >(
    quote: T,
    couponCode: string | undefined,
    userId: string,
    partnerId?: string,
  ): Promise<T & { fundedBy?: 'platform' | 'partner' }> {
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
      const applied = applyPromotionToQuote<T>(quote, {
        code: promo.code,
        title: promo.title,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
      });
      return { ...applied, fundedBy: 'platform' };
    }

    const promo = resolved.promotion;

    // Partner-scoped promotions only apply at their own shops, and only once admin-approved —
    // treat both failures as "invalid code" rather than leaking why, same as any other ineligible code.
    if (promo.partnerUserId) {
      if (promo.approvalStatus !== 'approved') {
        throw new BadRequestException('Invalid or expired promo code');
      }
      if (!partnerId || promo.partnerUserId.toString() !== partnerId) {
        throw new BadRequestException('This promo code is not valid for the selected shop');
      }
    }

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

    const applied = applyPromotionToQuote(quote, {
      code: promo.code,
      title: promo.title,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
    });
    return { ...applied, fundedBy: promo.fundedBy };
  }

  async recordRedemption(userId: string, code: string, orderId: string) {
    const normalized = normalizePromotionCode(code);
    if (!normalized) return;

    const personal = await this.customerPromoModel.findOne({
      code: normalized,
      userId: new Types.ObjectId(userId),
    });
    if (personal) {
      // Atomic claim: `redeemedAt: null` in the filter (not a fetch-then-check-then-save) so two
      // concurrent orders using the same one-time personal promo can't both pass the check before
      // either write lands — only the first to hit this line wins the update.
      await this.customerPromoModel.updateOne(
        { _id: personal._id, redeemedAt: null },
        { redeemedAt: new Date(), orderId: new Types.ObjectId(orderId) },
      );
      return;
    }

    const promotion = await this.promotionModel.findOne({ code: normalized });
    if (!promotion) return;

    const userObjectId = new Types.ObjectId(userId);

    if (promotion.maxUsesPerCustomer != null) {
      // Atomic per-customer cap claim — see PromotionUsageCounter for why counting
      // PromotionRedemption rows and then inserting isn't safe under concurrency.
      try {
        await this.usageCounterModel.findOneAndUpdate(
          { userId: userObjectId, promotionId: promotion._id, count: { $lt: promotion.maxUsesPerCustomer } },
          { $inc: { count: 1 } },
          { upsert: true },
        );
      } catch (err) {
        if (this.isDuplicateKeyError(err)) {
          // The counter doc already exists and is at (or past) its cap — the upsert couldn't
          // match it (count $lt failed) and couldn't insert a new one either (unique index).
          throw new BadRequestException('This promo code has already reached its usage limit');
        }
        throw err;
      }
    }

    // Guards a retried call for the same order from double-inserting (unique orderId+promotionId
    // index) — the maxUsesPerCustomer cap itself was already claimed atomically above.
    try {
      await this.promotionRedemptionModel.create({
        userId: userObjectId,
        promotionId: promotion._id,
        orderId: new Types.ObjectId(orderId),
      });
    } catch (err) {
      if (!this.isDuplicateKeyError(err)) throw err;
    }
  }

  /** Purges usage-tracking rows for this promotion that reference a since-deleted user (e.g. a
   * spam account removed by the daily cleanup sweep). Deleted accounts leave orphaned
   * PromotionUsageCounter/PromotionRedemption/CustomerPromo rows behind — those permanently eat
   * into `maxUsesPerCustomer` caps and pollute redemption records for a code that was actually
   * abused by bots, not real customers. Only orphaned rows are removed; existing customers' own
   * usage/caps are left untouched. */
  async resetOrphanedUsage(promotionId: string) {
    const promo = await this.promotionModel.findById(promotionId);
    if (!promo) throw new NotFoundException('Promotion not found');

    const counters = await this.usageCounterModel.find({ promotionId: promo._id }).select('userId');
    const redemptions = await this.promotionRedemptionModel
      .find({ promotionId: promo._id })
      .select('userId');
    const customerPromos = await this.customerPromoModel
      .find({ sourcePromotionId: promo._id })
      .select('userId');

    const referencedIds = new Set(
      [...counters, ...redemptions, ...customerPromos].map((doc) => doc.userId.toString()),
    );
    if (referencedIds.size === 0) {
      return { success: true, data: { removedUsageCounters: 0, removedRedemptions: 0, removedCustomerPromos: 0 } };
    }

    const existingUsers = await this.userModel
      .find({ _id: { $in: [...referencedIds].map((id) => new Types.ObjectId(id)) } })
      .select('_id');
    const existingIds = new Set(existingUsers.map((u) => u._id.toString()));
    const orphanIds = [...referencedIds]
      .filter((id) => !existingIds.has(id))
      .map((id) => new Types.ObjectId(id));

    if (orphanIds.length === 0) {
      return { success: true, data: { removedUsageCounters: 0, removedRedemptions: 0, removedCustomerPromos: 0 } };
    }

    const [counterResult, redemptionResult, customerPromoResult] = await Promise.all([
      this.usageCounterModel.deleteMany({ promotionId: promo._id, userId: { $in: orphanIds } }),
      this.promotionRedemptionModel.deleteMany({ promotionId: promo._id, userId: { $in: orphanIds } }),
      this.customerPromoModel.deleteMany({ sourcePromotionId: promo._id, userId: { $in: orphanIds } }),
    ]);

    return {
      success: true,
      data: {
        removedUsageCounters: counterResult.deletedCount ?? 0,
        removedRedemptions: redemptionResult.deletedCount ?? 0,
        removedCustomerPromos: customerPromoResult.deletedCount ?? 0,
      },
    };
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
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

  /** Read-only view for partner-web: currently-active platform-wide promotions that could
   * apply to orders at any shop. Promotions aren't branch-scoped, so this skips the
   * per-customer new-customer-audience eligibility filtering that listDealsForCustomer does. */
  async listActivePromotionsForPartner() {
    const now = new Date();
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
      .filter((p) => isPromotionActive(p, now))
      .map((p) => this.serializeDealFromPromotion(p));

    return { success: true, data: deals };
  }

  private serializePartnerPromotion(p: PromotionDocument) {
    return {
      _id: p._id.toString(),
      code: p.code,
      title: p.title,
      description: p.description,
      discountType: p.discountType,
      discountValue: p.discountValue,
      minOrderAmount: p.minOrderAmount,
      isActive: p.isActive,
      maxUsesPerCustomer: p.maxUsesPerCustomer,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      fundedBy: p.fundedBy,
      approvalStatus: p.approvalStatus,
      adminNote: p.adminNote,
      createdAt: p.createdAt,
    };
  }

  /** Promotions this partner created themselves — any approval status, so they can see what's
   * pending/rejected as well as what's live. */
  async listPromotionsForPartnerOwner(partnerUserId: string) {
    const items = await this.promotionModel
      .find({ partnerUserId: new Types.ObjectId(partnerUserId) })
      .sort({ createdAt: -1 });
    return { success: true, data: items.map((p) => this.serializePartnerPromotion(p)) };
  }

  /** Partner self-service promo creation — always partner-funded (deducted from their own payout at
   * settlement, never Lunara's cost) and scoped to their own branches only. Starts 'pending' and
   * isn't usable at checkout until an admin approves it (see applyCouponToQuote above). */
  async createPartnerPromotion(partnerUserId: string, dto: CreatePartnerPromotionDto) {
    if (dto.discountType === 'percent' && dto.discountValue > MAX_PARTNER_PERCENT_DISCOUNT) {
      throw new BadRequestException(
        `Partner promotions can discount at most ${MAX_PARTNER_PERCENT_DISCOUNT}% off`,
      );
    }
    if (dto.discountType === 'fixed' && dto.discountValue > MAX_PARTNER_FIXED_DISCOUNT) {
      throw new BadRequestException(
        `Partner promotions can discount at most ₱${MAX_PARTNER_FIXED_DISCOUNT}`,
      );
    }

    let promo: PromotionDocument;
    try {
      promo = await this.promotionModel.create({
        code: dto.code.toUpperCase(),
        title: dto.title,
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minOrderAmount: dto.minOrderAmount ?? 0,
        isActive: true,
        audience: PromotionAudience.ALL,
        kind: PromotionKind.STANDARD,
        maxUsesPerCustomer: dto.maxUsesPerCustomer,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        partnerUserId: new Types.ObjectId(partnerUserId),
        fundedBy: 'partner',
        approvalStatus: 'pending',
      });
    } catch (e) {
      if ((e as { code?: number })?.code === 11000) {
        throw new ConflictException(`A promotion with code "${dto.code.toUpperCase()}" already exists`);
      }
      throw e;
    }
    return { success: true, data: this.serializePartnerPromotion(promo) };
  }

  /** Lets a partner turn their own promotion on/off without re-triggering admin review — toggling
   * off is always safe, and toggling a previously-approved one back on doesn't need re-approval. */
  async setPartnerPromotionActive(partnerUserId: string, promotionId: string, isActive: boolean) {
    const promo = await this.promotionModel.findById(promotionId);
    if (!promo) throw new NotFoundException('Promotion not found');
    if (!promo.partnerUserId || promo.partnerUserId.toString() !== partnerUserId) {
      throw new ForbiddenException("You don't have access to this promotion");
    }
    promo.isActive = isActive;
    await promo.save();
    return { success: true, data: this.serializePartnerPromotion(promo) };
  }
}
