import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  computeRiderWalletBalances,
  parseEarningReference,
  RIDER_EARNING_TYPE_LABELS,
  RIDER_MIN_WITHDRAWAL,
  RIDER_PAYOUT_METHOD,
  RIDER_PAYOUT_METHOD_LABELS,
  RIDER_WITHDRAWAL_STATUS,
  RIDER_WITHDRAWAL_STATUS_LABELS,
  taskEarningReference,
  type RiderEarningType,
  type RiderPayoutMethod,
} from '@lunara/utils';
import { UpdatePayoutMethodDto } from './dto/rider-wallet.dto';
import { Rider, RiderDocument } from './schemas/rider.schema';
import {
  RiderCashRemittance,
  RiderCashRemittanceDocument,
  RiderWalletTransaction,
  RiderWalletTransactionDocument,
  RiderWithdrawal,
  RiderWithdrawalDocument,
} from './schemas/rider-wallet.schema';

function serializePayoutMethod(rider: RiderDocument) {
  if (!rider.payoutMethod) {
    return { method: null as RiderPayoutMethod | null, configured: false };
  }

  return {
    method: rider.payoutMethod,
    label: RIDER_PAYOUT_METHOD_LABELS[rider.payoutMethod],
    configured: true,
    gcashNumber: rider.gcashNumber,
    mayaNumber: rider.mayaNumber,
    bankName: rider.bankName,
    bankAccountName: rider.bankAccountName,
    bankAccountNumber: rider.bankAccountNumber,
  };
}

function payoutSnapshotFromRider(rider: RiderDocument) {
  if (!rider.payoutMethod) {
    throw new BadRequestException('Configure a payout method before withdrawing');
  }

  if (rider.payoutMethod === RIDER_PAYOUT_METHOD.GCASH) {
    return {
      method: rider.payoutMethod,
      gcashNumber: rider.gcashNumber,
    };
  }

  if (rider.payoutMethod === RIDER_PAYOUT_METHOD.MAYA) {
    return {
      method: rider.payoutMethod,
      mayaNumber: rider.mayaNumber,
    };
  }

  return {
    method: rider.payoutMethod,
    bankName: rider.bankName,
    bankAccountName: rider.bankAccountName,
    bankAccountNumber: rider.bankAccountNumber,
  };
}

@Injectable()
export class RiderWalletService {
  constructor(
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(RiderWalletTransaction.name)
    private transactionModel: Model<RiderWalletTransactionDocument>,
    @InjectModel(RiderWithdrawal.name)
    private withdrawalModel: Model<RiderWithdrawalDocument>,
    @InjectModel(RiderCashRemittance.name)
    private remittanceModel: Model<RiderCashRemittanceDocument>,
  ) {}

  private riderObjectId(userId: string) {
    return new Types.ObjectId(userId);
  }

  async findOrCreateRider(userId: string) {
    let rider = await this.riderModel.findOne({ userId: this.riderObjectId(userId) });
    if (!rider) {
      rider = await this.riderModel.create({ userId: this.riderObjectId(userId) });
    }
    return rider;
  }

  private async maybeBackfillWallet(rider: RiderDocument): Promise<void> {
    if (rider.walletBackfilled || rider.walletBalance > 0) return;
    if (rider.totalEarnings <= 0) return;

    rider.walletBalance = rider.totalEarnings;
    rider.walletBackfilled = true;
    await rider.save();

    await this.transactionModel
      .create({
        riderUserId: rider.userId,
        type: 'credit',
        amount: rider.totalEarnings,
        reference: `backfill:${rider.userId.toString()}`,
        description: 'Wallet balance synced from lifetime earnings',
      })
      .catch(() => {});
  }

  private async pendingWithdrawalTotal(userId: string) {
    const result = await this.withdrawalModel.aggregate<{ total: number }>([
      {
        $match: {
          riderUserId: this.riderObjectId(userId),
          status: RIDER_WITHDRAWAL_STATUS.PENDING,
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result[0]?.total ?? 0;
  }

  async getWallet(userId: string) {
    const rider = await this.findOrCreateRider(userId);
    await this.maybeBackfillWallet(rider);

    const pendingWithdrawalTotal = await this.pendingWithdrawalTotal(userId);
    const balances = computeRiderWalletBalances(
      rider.walletBalance,
      rider.pendingHold,
      pendingWithdrawalTotal,
    );

    const transactions = await this.transactionModel
      .find({ riderUserId: this.riderObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(30);

    return {
      success: true,
      data: {
        ...balances,
        currency: 'PHP',
        minWithdrawal: RIDER_MIN_WITHDRAWAL,
        pendingWithdrawalTotal,
        payoutMethod: serializePayoutMethod(rider),
        recentTransactions: transactions.map((tx) => ({
          type: tx.type,
          amount: tx.amount,
          reference: tx.reference,
          description: tx.description,
          createdAt: tx.createdAt,
        })),
      },
    };
  }

  async getPayoutMethod(userId: string) {
    const rider = await this.findOrCreateRider(userId);
    return { success: true, data: serializePayoutMethod(rider) };
  }

  async updatePayoutMethod(userId: string, dto: UpdatePayoutMethodDto) {
    const rider = await this.findOrCreateRider(userId);

    if (dto.method === RIDER_PAYOUT_METHOD.GCASH) {
      if (!dto.gcashNumber) throw new BadRequestException('GCash number is required');
      rider.payoutMethod = dto.method;
      rider.gcashNumber = dto.gcashNumber;
      rider.mayaNumber = undefined;
      rider.bankName = undefined;
      rider.bankAccountName = undefined;
      rider.bankAccountNumber = undefined;
    } else if (dto.method === RIDER_PAYOUT_METHOD.MAYA) {
      if (!dto.mayaNumber) throw new BadRequestException('Maya number is required');
      rider.payoutMethod = dto.method;
      rider.mayaNumber = dto.mayaNumber;
      rider.gcashNumber = undefined;
      rider.bankName = undefined;
      rider.bankAccountName = undefined;
      rider.bankAccountNumber = undefined;
    } else {
      if (!dto.bankName || !dto.bankAccountName || !dto.bankAccountNumber) {
        throw new BadRequestException('Bank name, account name, and account number are required');
      }
      rider.payoutMethod = dto.method;
      rider.bankName = dto.bankName;
      rider.bankAccountName = dto.bankAccountName;
      rider.bankAccountNumber = dto.bankAccountNumber;
      rider.gcashNumber = undefined;
      rider.mayaNumber = undefined;
    }

    await rider.save();
    return { success: true, data: serializePayoutMethod(rider) };
  }

  async creditFromTask(userId: string, orderId: string, type: RiderEarningType, amount: number) {
    const label = RIDER_EARNING_TYPE_LABELS[type];
    return this.creditEarning(userId, {
      referenceId: orderId,
      type,
      amount,
      description: `${label} · order ${orderId.slice(-6)}`,
    });
  }

  async creditEarning(
    userId: string,
    input: {
      referenceId: string;
      type: RiderEarningType;
      amount: number;
      description: string;
    },
  ) {
    const rider = await this.findOrCreateRider(userId);
    const reference = taskEarningReference(input.referenceId, input.type);

    const existing = await this.transactionModel.findOne({
      riderUserId: this.riderObjectId(userId),
      reference,
    });
    if (existing) {
      return {
        walletBalance: rider.walletBalance,
        credited: false,
      };
    }

    rider.walletBalance += input.amount;
    await rider.save();

    await this.transactionModel.create({
      riderUserId: rider.userId,
      type: 'credit',
      amount: input.amount,
      reference,
      description: input.description,
    });

    return {
      walletBalance: rider.walletBalance,
      credited: true,
    };
  }

  async sumCreditsSince(userId: string, since: Date) {
    const result = await this.transactionModel.aggregate<{ total: number }>([
      {
        $match: {
          riderUserId: this.riderObjectId(userId),
          type: 'credit',
          createdAt: { $gte: since },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result[0]?.total ?? 0;
  }

  async getRecentEarningEntries(userId: string, limit = 30) {
    const items = await this.transactionModel
      .find({
        riderUserId: this.riderObjectId(userId),
        type: 'credit',
        reference: { $regex: /^earning:/ },
      })
      .sort({ createdAt: -1 })
      .limit(limit);

    return items
      .map((item) => {
        const parsed = parseEarningReference(item.reference);
        if (!parsed) return null;
        return {
          type: parsed.type,
          amount: item.amount,
          orderId: parsed.type === 'pickup' || parsed.type === 'delivery' ? parsed.id : undefined,
          note: item.description,
          earnedAt: item.createdAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  async requestWithdrawal(userId: string, amount: number) {
    const rider = await this.findOrCreateRider(userId);
    if (!rider.payoutMethod) {
      throw new BadRequestException('Configure a payout method before withdrawing');
    }
    if (amount < RIDER_MIN_WITHDRAWAL) {
      throw new BadRequestException(`Minimum withdrawal is ₱${RIDER_MIN_WITHDRAWAL}`);
    }

    const pendingWithdrawalTotal = await this.pendingWithdrawalTotal(userId);
    const { withdrawableBalance } = computeRiderWalletBalances(
      rider.walletBalance,
      rider.pendingHold,
      pendingWithdrawalTotal,
    );

    if (amount > withdrawableBalance) {
      throw new BadRequestException('Insufficient withdrawable balance');
    }

    const snapshot = payoutSnapshotFromRider(rider);
    const withdrawal = await this.withdrawalModel.create({
      riderUserId: rider.userId,
      amount,
      ...snapshot,
      status: RIDER_WITHDRAWAL_STATUS.PENDING,
    });

    return {
      success: true,
      data: this.serializeWithdrawal(withdrawal),
    };
  }

  async listWithdrawals(userId: string, limit = 20) {
    const items = await this.withdrawalModel
      .find({ riderUserId: this.riderObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit);

    return {
      success: true,
      data: items.map((item) => this.serializeWithdrawal(item)),
    };
  }

  async listWithdrawalsForAdmin(status?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const items = await this.withdrawalModel.find(filter).sort({ createdAt: -1 }).limit(100);
    const riderIds = [...new Set(items.map((item) => item.riderUserId.toString()))];
    const riders = await this.riderModel.find({ userId: { $in: riderIds.map((id) => new Types.ObjectId(id)) } });
    const riderByUserId = new Map(riders.map((r) => [r.userId.toString(), r]));

    return {
      success: true,
      data: items.map((item) => {
        const rider = riderByUserId.get(item.riderUserId.toString());
        return {
          ...this.serializeWithdrawal(item),
          riderName: rider
            ? `${rider.firstName ?? ''} ${rider.lastName ?? ''}`.trim() || item.riderUserId.toString()
            : item.riderUserId.toString(),
        };
      }),
    };
  }

  async approveWithdrawal(withdrawalId: string, adminUserId: string, adminNote?: string) {
    const withdrawal = await this.withdrawalModel.findById(withdrawalId);
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (withdrawal.status !== RIDER_WITHDRAWAL_STATUS.PENDING) {
      throw new BadRequestException('Withdrawal is not pending');
    }

    const rider = await this.riderModel.findOne({ userId: withdrawal.riderUserId });
    if (!rider) throw new NotFoundException('Rider not found');

    const pendingWithdrawalTotal = await this.pendingWithdrawalTotal(withdrawal.riderUserId.toString());
    const { withdrawableBalance } = computeRiderWalletBalances(
      rider.walletBalance,
      rider.pendingHold,
      pendingWithdrawalTotal,
    );
    if (withdrawal.amount > withdrawableBalance) {
      throw new BadRequestException('Rider no longer has sufficient withdrawable balance');
    }

    rider.walletBalance -= withdrawal.amount;
    await rider.save();

    withdrawal.status = RIDER_WITHDRAWAL_STATUS.PAID;
    withdrawal.adminNote = adminNote;
    withdrawal.processedBy = new Types.ObjectId(adminUserId);
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    await this.transactionModel.create({
      riderUserId: withdrawal.riderUserId,
      type: 'debit',
      amount: withdrawal.amount,
      reference: `withdrawal:${withdrawal._id.toString()}`,
      description: `Withdrawal paid via ${RIDER_PAYOUT_METHOD_LABELS[withdrawal.method]}`,
    });

    return { success: true, data: this.serializeWithdrawal(withdrawal) };
  }

  async rejectWithdrawal(withdrawalId: string, adminUserId: string, adminNote?: string) {
    const withdrawal = await this.withdrawalModel.findById(withdrawalId);
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (withdrawal.status !== RIDER_WITHDRAWAL_STATUS.PENDING) {
      throw new BadRequestException('Withdrawal is not pending');
    }

    withdrawal.status = RIDER_WITHDRAWAL_STATUS.REJECTED;
    withdrawal.adminNote = adminNote;
    withdrawal.processedBy = new Types.ObjectId(adminUserId);
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    return { success: true, data: this.serializeWithdrawal(withdrawal) };
  }

  async setWalletHold(userId: string, pendingHold: number) {
    const rider = await this.findOrCreateRider(userId);
    if (pendingHold > rider.walletBalance) {
      throw new BadRequestException('Hold cannot exceed wallet balance');
    }
    rider.pendingHold = pendingHold;
    await rider.save();

    const pendingWithdrawalTotal = await this.pendingWithdrawalTotal(userId);
    const balances = computeRiderWalletBalances(
      rider.walletBalance,
      rider.pendingHold,
      pendingWithdrawalTotal,
    );

    return { success: true, data: balances };
  }

  /**
   * Called immediately after cash is collected for an order. Creates a netting
   * debit that offsets the rider's earned fee for that task against the cash
   * amount, reducing what the rider owes to admin on remittance.
   *
   * Idempotent: if a remittance record already exists for the same order+stage,
   * this returns early without creating a duplicate.
   */
  async netEarningsAgainstCash(
    riderUserId: string,
    orderId: string,
    paymentId: string,
    cashAmount: number,
    stage: 'pickup' | 'delivery',
  ) {
    const earningType = stage === 'pickup' ? 'pickup' : 'delivery';
    const earningRef = taskEarningReference(orderId, earningType);

    // Check idempotency via unique index on (riderUserId, orderId, stage)
    const existing = await this.remittanceModel.findOne({
      riderUserId: new Types.ObjectId(riderUserId),
      orderId: new Types.ObjectId(orderId),
      stage,
    });
    if (existing) return { alreadyNetted: true, remittance: this.serializeRemittance(existing) };

    // Find the credit transaction for this earning to get the exact amount
    const earningTx = await this.transactionModel.findOne({
      riderUserId: new Types.ObjectId(riderUserId),
      reference: earningRef,
      type: 'credit',
    });

    // If the earning hasn't been credited yet (race condition), skip netting
    if (!earningTx) return { alreadyNetted: false, remittance: null };

    const earningOffset = earningTx.amount;
    const netRemittance = Math.max(0, cashAmount - earningOffset);
    const nettingRef = `netting:${stage}:${orderId}`;

    const rider = await this.findOrCreateRider(riderUserId);
    rider.walletBalance = Math.max(0, rider.walletBalance - earningOffset);
    await rider.save();

    await this.transactionModel.create({
      riderUserId: new Types.ObjectId(riderUserId),
      type: 'netting',
      amount: earningOffset,
      reference: nettingRef,
      description: `Fee offset against cash collected at ${stage} · order ${orderId.slice(-6)}`,
    });

    const remittance = await this.remittanceModel.create({
      riderUserId: new Types.ObjectId(riderUserId),
      orderId: new Types.ObjectId(orderId),
      paymentId: new Types.ObjectId(paymentId),
      stage,
      cashAmount,
      earningOffset,
      netRemittance,
      status: 'pending',
    });

    return { alreadyNetted: false, remittance: this.serializeRemittance(remittance) };
  }

  async submitRemittance(riderUserId: string) {
    const items = await this.remittanceModel.find({
      riderUserId: new Types.ObjectId(riderUserId),
      status: 'pending',
    });
    if (items.length === 0) throw new NotFoundException('No pending cash remittances to submit');

    await this.remittanceModel.updateMany(
      { _id: { $in: items.map((i) => i._id) } },
      { status: 'submitted', submittedAt: new Date() },
    );

    return {
      success: true,
      data: {
        submittedCount: items.length,
        totalNetRemittance: items.reduce((s, r) => s + r.netRemittance, 0),
      },
    };
  }

  async getCashSummary(riderUserId: string) {
    const pending = await this.remittanceModel
      .find({ riderUserId: new Types.ObjectId(riderUserId), status: { $in: ['pending', 'submitted'] } })
      .sort({ createdAt: -1 });

    const recent = await this.remittanceModel
      .find({ riderUserId: new Types.ObjectId(riderUserId), status: 'remitted' })
      .sort({ remittedAt: -1 })
      .limit(20);

    const totalCashCollected = pending.reduce((s, r) => s + r.cashAmount, 0);
    const totalEarningOffset = pending.reduce((s, r) => s + r.earningOffset, 0);
    const totalNetRemittance = pending.reduce((s, r) => s + r.netRemittance, 0);

    return {
      success: true,
      data: {
        pendingRemittance: {
          count: pending.length,
          totalCashCollected,
          totalEarningOffset,
          totalNetRemittance,
          items: pending.map((r) => this.serializeRemittance(r)),
        },
        recentRemitted: recent.map((r) => this.serializeRemittance(r)),
      },
    };
  }

  async verifyRemittanceBatch(riderUserId: string, adminUserId: string, remittanceIds?: string[]) {
    const filter: Record<string, unknown> = {
      riderUserId: new Types.ObjectId(riderUserId),
      status: { $in: ['pending', 'submitted'] },
    };
    if (remittanceIds?.length) {
      filter._id = { $in: remittanceIds.map((id) => new Types.ObjectId(id)) };
    }

    const items = await this.remittanceModel.find(filter);
    if (items.length === 0) throw new NotFoundException('No pending remittances found');

    const now = new Date();
    await this.remittanceModel.updateMany(
      { _id: { $in: items.map((i) => i._id) } },
      { status: 'remitted', remittedAt: now, verifiedBy: new Types.ObjectId(adminUserId) },
    );

    const totalVerified = items.reduce((s, r) => s + r.netRemittance, 0);
    return {
      success: true,
      data: { verifiedCount: items.length, totalNetRemittance: totalVerified },
    };
  }

  async getRemittanceForOrder(orderId: string, stage: 'pickup' | 'delivery') {
    const record = await this.remittanceModel.findOne({
      orderId: new Types.ObjectId(orderId),
      stage,
    });
    if (!record) return null;
    return {
      earningOffset: record.earningOffset,
      netRemittance: record.netRemittance,
      status: record.status,
    };
  }

  async listRemittancesForAdmin(riderUserId?: string, status?: string) {
    const filter: Record<string, unknown> = {};
    if (riderUserId) filter.riderUserId = new Types.ObjectId(riderUserId);
    if (status) filter.status = status;

    const items = await this.remittanceModel.find(filter).sort({ createdAt: -1 }).limit(100);
    return { success: true, data: items.map((r) => this.serializeRemittance(r)) };
  }

  private serializeRemittance(r: RiderCashRemittanceDocument) {
    return {
      _id: r._id.toString(),
      riderUserId: r.riderUserId.toString(),
      orderId: r.orderId.toString(),
      paymentId: r.paymentId.toString(),
      stage: r.stage,
      cashAmount: r.cashAmount,
      earningOffset: r.earningOffset,
      netRemittance: r.netRemittance,
      status: r.status,
      submittedAt: r.submittedAt?.toISOString(),
      remittedAt: r.remittedAt?.toISOString(),
      verifiedBy: r.verifiedBy?.toString(),
      createdAt: r.createdAt.toISOString(),
    };
  }

  private serializeWithdrawal(withdrawal: RiderWithdrawalDocument) {
    return {
      _id: withdrawal._id.toString(),
      amount: withdrawal.amount,
      method: withdrawal.method,
      methodLabel: RIDER_PAYOUT_METHOD_LABELS[withdrawal.method],
      status: withdrawal.status,
      statusLabel: RIDER_WITHDRAWAL_STATUS_LABELS[withdrawal.status],
      gcashNumber: withdrawal.gcashNumber,
      mayaNumber: withdrawal.mayaNumber,
      bankName: withdrawal.bankName,
      bankAccountName: withdrawal.bankAccountName,
      bankAccountNumber: withdrawal.bankAccountNumber,
      adminNote: withdrawal.adminNote,
      processedAt: withdrawal.processedAt,
      createdAt: withdrawal.createdAt,
    };
  }
}
