import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { CustomerPromo, CustomerPromoDocument } from '../promotions/schemas/customer-promo.schema';
import { UserProfile, UserProfileDocument } from '../users/schemas/user-profile.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { OrderStatus } from '@lunara/types';
import { NotificationDispatchService } from '../push/notification-dispatch.service';
import { PointsTransaction, PointsTransactionDocument } from './schemas/points-transaction.schema';
import {
  PartnerRewardsProgram,
  PartnerRewardsProgramDocument,
} from './schemas/partner-rewards-program.schema';
import {
  DEFAULT_POINTS_PER_COMPLETED_ORDER,
  REFERRAL_BONUS_POINTS,
  REWARD_VOUCHER_VALIDITY_DAYS,
  TIERS,
} from './rewards.catalog';
import { UpdateRewardsProgramDto } from '../partner/dto/update-rewards-program.dto';
import {
  CreateRewardsCatalogItemDto,
  UpdateRewardsCatalogItemDto,
} from '../partner/dto/rewards-catalog-item.dto';

const VOUCHER_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(CustomerPromo.name) private customerPromoModel: Model<CustomerPromoDocument>,
    @InjectModel(PointsTransaction.name)
    private pointsTransactionModel: Model<PointsTransactionDocument>,
    @InjectModel(PartnerRewardsProgram.name)
    private programModel: Model<PartnerRewardsProgramDocument>,
    @InjectModel(UserProfile.name)
    private userProfileModel: Model<UserProfileDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private notificationDispatch: NotificationDispatchService,
  ) {}

  private isDuplicateKeyError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
  }

  /** Mirrors customer-order-notification.service.ts's getPreferences() so points notifications
   * respect the same push opt-out as order notifications instead of always pushing. */
  private async wantsPush(userId: string): Promise<boolean> {
    const customer = await this.customerModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .select('notificationPreferences')
      .lean();
    return customer?.notificationPreferences?.push ?? true;
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
      currentTierMin: current.min,
    };
  }

  /** Ledger write shared by every credit/debit path. `partnerUserId` scopes the points to one
   * partner's program (order credits, and redemptions spent from a partner balance); omit it for
   * the platform-wide referral bucket. */
  private async recordTransaction(
    userId: string,
    type: 'credit' | 'debit',
    amount: number,
    reference: string,
    description: string,
    sourceType: 'order' | 'referral' | 'redemption',
    opts?: { branchId?: string; partnerUserId?: string },
  ): Promise<boolean> {
    try {
      await this.pointsTransactionModel.create({
        userId: new Types.ObjectId(userId),
        type,
        amount,
        reference,
        description,
        sourceType,
        branchId: opts?.branchId ? new Types.ObjectId(opts.branchId) : undefined,
        partnerUserId: opts?.partnerUserId ? new Types.ObjectId(opts.partnerUserId) : undefined,
      });
      return true;
    } catch (err) {
      if (this.isDuplicateKeyError(err)) return false;
      throw err;
    }
  }

  private async notifyPointsChange(
    userId: string,
    changeType: 'credit' | 'debit',
    amount: number,
    description: string,
    balance: number,
  ) {
    const sendPush = await this.wantsPush(userId).catch(() => true);
    await this.notificationDispatch
      .dispatch({
        userId,
        title: changeType === 'credit' ? 'Points earned' : 'Points redeemed',
        body: `${changeType === 'credit' ? '+' : '-'}${amount} pts — ${description}. New balance: ${balance} pts.`,
        channelId: 'rewards',
        sendPush,
        data: { type: 'rewards_update', changeType, amount, balance },
      })
      .catch(() => {});
  }

  // ───────────────────────── Earning (order completion) ─────────────────────────

  /**
   * Single entry point for "an order just reached a terminal completed state" — called from
   * every path that can complete an order (rider delivery, in-store customer pickup, manual
   * admin status update) so points crediting doesn't silently depend on which of those paths a
   * given order happened to take. Credits only if the order's partner has an active rewards
   * program — loyalty is opt-in per partner now, not automatic platform-wide, so an order at a
   * partner who never set one up simply earns nothing.
   */
  async creditForCompletedOrder(order: {
    _id: unknown;
    customerId: unknown;
    branchId?: unknown;
    partnerId?: unknown;
  }) {
    const orderId = String(order._id);
    const customerId = String(order.customerId);
    const branchId = order.branchId ? String(order.branchId) : undefined;
    const partnerId = order.partnerId ? String(order.partnerId) : undefined;

    try {
      if (partnerId) {
        const program = await this.programModel.findOne({
          partnerUserId: new Types.ObjectId(partnerId),
          isActive: true,
        });
        if (program) {
          await this.creditPartnerPoints(
            customerId,
            partnerId,
            program.pointsPerCompletedOrder,
            `order-complete-${orderId}`,
            'Earned from completed order',
            branchId,
          );
        }
      }

      const priorCompletedOrders = await this.orderModel.countDocuments({
        customerId: new Types.ObjectId(customerId),
        status: { $in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED] },
        _id: { $ne: new Types.ObjectId(orderId) },
      });
      await this.maybeCreditReferralForFirstOrder(customerId, priorCompletedOrders === 0);
    } catch (err) {
      this.logger.warn(
        `Rewards crediting failed for completed order ${orderId}: ${(err as Error).message}`,
      );
    }
  }

  private async creditPartnerPoints(
    userId: string,
    partnerId: string,
    amount: number,
    reference: string,
    description: string,
    branchId?: string,
  ) {
    const written = await this.recordTransaction(userId, 'credit', amount, reference, description, 'order', {
      branchId,
      partnerUserId: partnerId,
    });
    if (!written) return; // duplicate reference — already credited

    const balance = await this.getPartnerBalance(userId, partnerId);
    await this.notifyPointsChange(userId, 'credit', amount, description, balance);
  }

  // ───────────────────────── Referral (platform-wide) ─────────────────────────

  async creditReferralBonus(referrerUserId: string, referredCustomerId: string) {
    const written = await this.recordTransaction(
      referrerUserId,
      'credit',
      REFERRAL_BONUS_POINTS,
      `referral-${referredCustomerId}`,
      'Earned from a successful referral',
      'referral',
    );
    if (!written) return;

    // Customer.loyaltyPoints mirrors the referral ledger total — kept as a plain field (rather
    // than always aggregating) because customer-web/mobile's own profile screens read it
    // directly off GET /customers/me (CustomersService.getProfile returns the raw document).
    await this.customerModel.updateOne(
      { userId: new Types.ObjectId(referrerUserId) },
      { $inc: { loyaltyPoints: REFERRAL_BONUS_POINTS } },
    );

    const balance = await this.getReferralBalance(referrerUserId);
    await this.notifyPointsChange(
      referrerUserId,
      'credit',
      REFERRAL_BONUS_POINTS,
      'Earned from a successful referral',
      balance,
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

  async getOrCreateReferralCode(userId: string) {
    const customer = await this.customerModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!customer) throw new NotFoundException('Customer profile not found');
    if (customer.referralCode) return { success: true, data: { referralCode: customer.referralCode } };

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = this.generateCode('REF');
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

  async resolveReferrerByCode(referralCode: string) {
    return this.customerModel.findOne({ referralCode: referralCode.toUpperCase() });
  }

  // ───────────────────────── Balances & history (customer-facing) ─────────────────────────

  private async sumPoints(userId: string, partnerUserId?: string): Promise<number> {
    const match: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (partnerUserId) {
      match.partnerUserId = new Types.ObjectId(partnerUserId);
    } else {
      match.partnerUserId = { $exists: false };
    }
    const [result] = await this.pointsTransactionModel.aggregate<{ total: number }>([
      { $match: match },
      {
        $group: {
          _id: null,
          total: {
            $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', { $multiply: ['$amount', -1] }] },
          },
        },
      },
    ]);
    return result?.total ?? 0;
  }

  async getPartnerBalance(userId: string, partnerUserId: string): Promise<number> {
    return this.sumPoints(userId, partnerUserId);
  }

  async getReferralBalance(userId: string): Promise<number> {
    return this.sumPoints(userId);
  }

  /** Every partner this customer has any point activity with, plus their platform-wide referral
   * balance — replaces the old single global balance now that points are earned per-shop. */
  async listMyBalances(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const totals = await this.pointsTransactionModel.aggregate<{
      _id: Types.ObjectId | null;
      total: number;
    }>([
      { $match: { userId: userObjectId, partnerUserId: { $exists: true } } },
      {
        $group: {
          _id: '$partnerUserId',
          total: {
            $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', { $multiply: ['$amount', -1] }] },
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const partnerIds = totals.map((t) => t._id).filter((id): id is Types.ObjectId => !!id);
    const profiles = await this.userProfileModel
      .find({ userId: { $in: partnerIds } })
      .select('userId displayName')
      .lean();
    const nameByPartnerId = new Map(profiles.map((p) => [p.userId.toString(), p.displayName]));

    const referralBalance = await this.getReferralBalance(userId);

    return {
      success: true,
      data: {
        referralBalance,
        partners: totals.map((t) => {
          const balance = t.total;
          return {
            partnerUserId: t._id!.toString(),
            partnerName: nameByPartnerId.get(t._id!.toString()) ?? 'Shop',
            balance,
            ...this.getTierProgress(balance),
          };
        }),
      },
    };
  }

  async getTransactions(userId: string, partnerUserId?: string) {
    const match: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (partnerUserId) match.partnerUserId = new Types.ObjectId(partnerUserId);

    const transactions = await this.pointsTransactionModel
      .find(match)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return { success: true, data: transactions };
  }

  // ───────────────────────── Catalog & redemption (customer-facing) ─────────────────────────

  private serializeCatalogItem(item: { itemId: string; title: string; description?: string; points: number; discountType: 'percent' | 'fixed'; discountValue: number }) {
    return {
      id: item.itemId,
      title: item.title,
      description: item.description,
      points: item.points,
      discountType: item.discountType,
      discountValue: item.discountValue,
    };
  }

  /** The redeemable catalog for one partner's shop — empty if that partner has no active rewards
   * program, rather than erroring, so a customer browsing a shop with no program just sees
   * nothing to redeem there. */
  async getCatalogForPartner(partnerUserId: string) {
    const program = await this.programModel.findOne({
      partnerUserId: new Types.ObjectId(partnerUserId),
      isActive: true,
    });
    if (!program) return { success: true, data: [] };
    return {
      success: true,
      data: program.catalog.filter((item) => item.isActive).map((item) => this.serializeCatalogItem(item)),
    };
  }

  /**
   * Redeems a catalog item from one partner's shop. Spends from that partner's own balance
   * first, then tops up any shortfall from the customer's platform-wide referral balance (a
   * referral bonus is usable at any participating shop, since it was never earned from one
   * partner's orders in the first place). The voucher is scoped to that partner, funded by that
   * partner's own payout — consistent with how a partner-created promotion code works.
   */
  async redeem(userId: string, partnerUserId: string, catalogItemId: string) {
    const program = await this.programModel.findOne({
      partnerUserId: new Types.ObjectId(partnerUserId),
      isActive: true,
    });
    if (!program) throw new NotFoundException('This shop has no active rewards program');

    const item = program.catalog.find((entry) => entry.itemId === catalogItemId && entry.isActive);
    if (!item) throw new NotFoundException('Reward not found');

    const [partnerBalance, referralBalance] = await Promise.all([
      this.getPartnerBalance(userId, partnerUserId),
      this.getReferralBalance(userId),
    ]);
    if (partnerBalance + referralBalance < item.points) {
      throw new BadRequestException('Not enough points to redeem this reward');
    }

    const spendFromPartner = Math.min(partnerBalance, item.points);
    const spendFromReferral = item.points - spendFromPartner;
    const userObjectId = new Types.ObjectId(userId);
    const redemptionRef = `redeem-${userId}-${partnerUserId}-${item.itemId}-${Date.now()}`;

    if (spendFromPartner > 0) {
      await this.recordTransaction(
        userId,
        'debit',
        spendFromPartner,
        `${redemptionRef}-partner`,
        `Redeemed for ${item.title}`,
        'redemption',
        { partnerUserId },
      );
    }
    if (spendFromReferral > 0) {
      await this.recordTransaction(
        userId,
        'debit',
        spendFromReferral,
        `${redemptionRef}-referral`,
        `Redeemed for ${item.title}`,
        'redemption',
      );
      // Keep Customer.loyaltyPoints (the referral-balance field customer-web/mobile profile
      // screens read directly) in sync with the referral ledger — see creditReferralBonus.
      await this.customerModel.updateOne({ userId: userObjectId }, { $inc: { loyaltyPoints: -spendFromReferral } });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REWARD_VOUCHER_VALIDITY_DAYS);

    let voucher: CustomerPromoDocument | undefined;
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = this.generateCode('RWD');
      try {
        voucher = await this.customerPromoModel.create({
          userId: userObjectId,
          code,
          title: item.title,
          description: item.description,
          discountType: item.discountType,
          discountValue: item.discountValue,
          expiresAt,
          partnerUserId: new Types.ObjectId(partnerUserId),
        });
        break;
      } catch (err) {
        if (!this.isDuplicateKeyError(err)) throw err;
      }
    }
    if (!voucher) throw new BadRequestException('Could not generate a voucher code, please try again');

    const newPartnerBalance = partnerBalance - spendFromPartner;
    const customer = await this.customerModel.findOne({ userId: userObjectId }).select('notificationPreferences');
    void this.notificationDispatch
      .dispatch({
        userId,
        title: 'Reward redeemed',
        body: `-${item.points} pts — ${item.title}.`,
        channelId: 'rewards',
        sendPush: customer?.notificationPreferences?.push ?? true,
        data: { type: 'rewards_update', changeType: 'debit', amount: item.points, balance: newPartnerBalance },
      })
      .catch(() => {});

    return { success: true, data: { voucher, balance: newPartnerBalance } };
  }

  private generateCode(prefix: string): string {
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += VOUCHER_CODE_CHARS[Math.floor(Math.random() * VOUCHER_CODE_CHARS.length)];
    }
    return `${prefix}${suffix}`;
  }

  // ───────────────────────── Partner-facing program management ─────────────────────────

  private serializeProgram(program: PartnerRewardsProgramDocument | null, partnerUserId: string) {
    if (!program) {
      return {
        partnerUserId,
        isActive: false,
        pointsPerCompletedOrder: DEFAULT_POINTS_PER_COMPLETED_ORDER,
        catalog: [],
      };
    }
    return {
      partnerUserId,
      isActive: program.isActive,
      pointsPerCompletedOrder: program.pointsPerCompletedOrder,
      catalog: program.catalog.map((item) => ({
        id: item.itemId,
        title: item.title,
        description: item.description,
        points: item.points,
        discountType: item.discountType,
        discountValue: item.discountValue,
        isActive: item.isActive,
      })),
    };
  }

  async getOwnProgram(partnerUserId: string) {
    const program = await this.programModel.findOne({ partnerUserId: new Types.ObjectId(partnerUserId) });
    return { success: true, data: this.serializeProgram(program, partnerUserId) };
  }

  private async findOrCreateProgram(partnerUserId: string) {
    let program = await this.programModel.findOne({ partnerUserId: new Types.ObjectId(partnerUserId) });
    if (!program) {
      program = await this.programModel.create({
        partnerUserId: new Types.ObjectId(partnerUserId),
        isActive: true,
        pointsPerCompletedOrder: DEFAULT_POINTS_PER_COMPLETED_ORDER,
        catalog: [],
      });
    }
    return program;
  }

  async updateOwnProgram(partnerUserId: string, dto: UpdateRewardsProgramDto) {
    const program = await this.findOrCreateProgram(partnerUserId);
    if (dto.isActive != null) program.isActive = dto.isActive;
    if (dto.pointsPerCompletedOrder != null) program.pointsPerCompletedOrder = dto.pointsPerCompletedOrder;
    await program.save();
    return { success: true, data: this.serializeProgram(program, partnerUserId) };
  }

  async addCatalogItem(partnerUserId: string, dto: CreateRewardsCatalogItemDto) {
    const program = await this.findOrCreateProgram(partnerUserId);
    program.catalog.push({
      itemId: randomUUID(),
      title: dto.title,
      description: dto.description,
      points: dto.points,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      isActive: true,
    });
    await program.save();
    return { success: true, data: this.serializeProgram(program, partnerUserId) };
  }

  async updateCatalogItem(partnerUserId: string, itemId: string, dto: UpdateRewardsCatalogItemDto) {
    const program = await this.programModel.findOne({ partnerUserId: new Types.ObjectId(partnerUserId) });
    if (!program) throw new NotFoundException('Rewards program not found');
    const item = program.catalog.find((entry) => entry.itemId === itemId);
    if (!item) throw new NotFoundException('Reward not found');

    if (dto.title != null) item.title = dto.title;
    if (dto.description != null) item.description = dto.description;
    if (dto.points != null) item.points = dto.points;
    if (dto.discountType != null) item.discountType = dto.discountType;
    if (dto.discountValue != null) item.discountValue = dto.discountValue;
    if (dto.isActive != null) item.isActive = dto.isActive;
    await program.save();
    return { success: true, data: this.serializeProgram(program, partnerUserId) };
  }

  async deleteCatalogItem(partnerUserId: string, itemId: string) {
    const program = await this.programModel.findOne({ partnerUserId: new Types.ObjectId(partnerUserId) });
    if (!program) throw new NotFoundException('Rewards program not found');
    const before = program.catalog.length;
    program.catalog = program.catalog.filter((entry) => entry.itemId !== itemId) as typeof program.catalog;
    if (program.catalog.length === before) throw new NotFoundException('Reward not found');
    await program.save();
    return { success: true, data: this.serializeProgram(program, partnerUserId) };
  }

  /** Read-only insights for a partner's own shop into their own rewards program — how many
   * points customers have earned from completed orders at this specific branch, and who's
   * earning them. Ownership of `branchId` is validated by the caller (PartnerController), not here. */
  async getLoyaltyStatsForBranch(branchId: string) {
    const branchObjectId = new Types.ObjectId(branchId);
    const match = { branchId: branchObjectId, sourceType: 'order' as const, type: 'credit' as const };

    const [summary] = await this.pointsTransactionModel.aggregate<{
      totalPointsEarned: number;
      ordersCounted: number;
      uniqueCustomers: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: null,
          totalPointsEarned: { $sum: '$amount' },
          ordersCounted: { $sum: 1 },
          uniqueCustomers: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          _id: 0,
          totalPointsEarned: 1,
          ordersCounted: 1,
          uniqueCustomers: { $size: '$uniqueCustomers' },
        },
      },
    ]);

    const topCustomerTotals = await this.pointsTransactionModel.aggregate<{
      _id: Types.ObjectId;
      points: number;
    }>([
      { $match: match },
      { $group: { _id: '$userId', points: { $sum: '$amount' } } },
      { $sort: { points: -1 } },
      { $limit: 10 },
    ]);

    const recent = await this.pointsTransactionModel
      .find(match)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const profileUserIds = [
      ...new Set([...topCustomerTotals.map((t) => t._id.toString()), ...recent.map((r) => r.userId.toString())]),
    ];
    const profiles = await this.userProfileModel
      .find({ userId: { $in: profileUserIds.map((id) => new Types.ObjectId(id)) } })
      .select('userId displayName avatarUrl')
      .lean();
    const profileByUserId = new Map(profiles.map((p) => [p.userId.toString(), p]));

    return {
      success: true,
      data: {
        totalPointsEarned: summary?.totalPointsEarned ?? 0,
        ordersCounted: summary?.ordersCounted ?? 0,
        uniqueCustomers: summary?.uniqueCustomers ?? 0,
        topCustomers: topCustomerTotals.map((t) => ({
          userId: t._id.toString(),
          displayName: profileByUserId.get(t._id.toString())?.displayName ?? 'Customer',
          avatarUrl: profileByUserId.get(t._id.toString())?.avatarUrl,
          points: t.points,
        })),
        recentActivity: recent.map((r) => ({
          createdAt: r.createdAt,
          amount: r.amount,
          description: r.description,
          customerName: profileByUserId.get(r.userId.toString())?.displayName ?? 'Customer',
        })),
      },
    };
  }
}
