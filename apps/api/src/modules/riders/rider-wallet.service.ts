import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '@lunara/types';
import {
  computeRiderWalletBalances,
  parseEarningReference,
  riderEarningAmount,
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
import { LedgerService } from '../ledger/ledger.service';
import { SettingsService } from '../settings/settings.service';
import { AuditLogService } from '../audit/audit-log.service';
import { User, UserDocument } from '../users/schemas/user.schema';
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
  private readonly logger = new Logger(RiderWalletService.name);

  constructor(
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(RiderWalletTransaction.name)
    private transactionModel: Model<RiderWalletTransactionDocument>,
    @InjectModel(RiderWithdrawal.name)
    private withdrawalModel: Model<RiderWithdrawalDocument>,
    @InjectModel(RiderCashRemittance.name)
    private remittanceModel: Model<RiderCashRemittanceDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private ledgerService: LedgerService,
    private settingsService: SettingsService,
    private auditLogService: AuditLogService,
  ) {}

  private riderObjectId(userId: string) {
    return new Types.ObjectId(userId);
  }

  /** Mongo duplicate-key error (E11000) — used to detect a concurrent/retried write losing the unique-index race. */
  private isDuplicateKeyError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
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

    const amount = rider.totalEarnings;
    const ref = `backfill:${rider.userId.toString()}`;

    rider.walletBalance = amount;
    rider.walletBackfilled = true;
    await rider.save();

    await this.transactionModel
      .create({
        riderUserId: rider.userId,
        type: 'credit',
        amount,
        reference: ref,
        description: 'Wallet balance synced from lifetime earnings',
      })
      .catch(() => {});

    await this.ledgerService
      .post(ref, 'rider_earning', rider.userId.toString(), [
        {
          accountType: 'rider_payout_expense',
          direction: 'debit',
          amount,
          description: `Backfill: lifetime earnings synced to wallet for rider ${rider.userId.toString()}`,
        },
        {
          accountType: 'rider_payable',
          accountSubject: rider.userId.toString(),
          direction: 'credit',
          amount,
          description: `Backfill: payable balance synced for rider ${rider.userId.toString()}`,
        },
      ])
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
    await this.findOrCreateRider(userId);
    const riderUserId = this.riderObjectId(userId);
    const reference = taskEarningReference(input.referenceId, input.type);

    // Create the transaction row first and let the unique (riderUserId, reference) index be the
    // idempotency gate — a duplicate insert fails atomically, so two concurrent calls for the same
    // task can never both credit the balance. Only the winner proceeds to increment walletBalance.
    try {
      await this.transactionModel.create({
        riderUserId,
        type: 'credit',
        amount: input.amount,
        reference,
        description: input.description,
      });
    } catch (err) {
      if (this.isDuplicateKeyError(err)) {
        const rider = await this.riderModel.findOne({ userId: riderUserId });
        return {
          walletBalance: rider?.walletBalance ?? 0,
          credited: false,
        };
      }
      throw err;
    }

    // $inc is an atomic increment at the DB level — unlike `rider.walletBalance += x; rider.save()`,
    // it can't lose an update when two credits/debits for the same rider land concurrently.
    const rider = await this.riderModel.findOneAndUpdate(
      { userId: riderUserId },
      { $inc: { walletBalance: input.amount } },
      { new: true },
    );

    return {
      walletBalance: rider?.walletBalance ?? 0,
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
    if (rider.partnerId) {
      throw new BadRequestException(
        'This rider is partner-managed — withdrawals go through their partner, not the platform wallet',
      );
    }
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

    void this.tryAutoApproveWithdrawal(withdrawal);

    return {
      success: true,
      data: this.serializeWithdrawal(withdrawal),
    };
  }

  /** Approves the withdrawal automatically when under the configured threshold, mirroring the
   *  manual admin approveWithdrawal flow. Failures fall back to manual review. */
  private async tryAutoApproveWithdrawal(withdrawal: RiderWithdrawalDocument) {
    try {
      const { enabled, threshold } = await this.settingsService.getAutoApproveConfig(
        'autoApproveWithdrawals',
      );
      if (!enabled || withdrawal.amount > threshold) return;

      const systemAdmin = await this.userModel.findOne({ role: UserRole.ADMIN });
      if (!systemAdmin) return;
      const adminUserId = systemAdmin._id.toString();

      await this.approveWithdrawal(
        withdrawal._id.toString(),
        adminUserId,
        'Auto-approved by automation settings',
      );

      await this.auditLogService.record({
        actorUserId: adminUserId,
        actorEmail: systemAdmin.email ?? 'system@automation',
        actorRole: 'system',
        method: 'AUTOMATION',
        path: `/admin/riders/withdrawals/${withdrawal._id.toString()}/approve`,
        action: 'automation.withdrawal.auto_approved',
        statusCode: 200,
        requestBody: { amount: withdrawal.amount },
      });
    } catch (err) {
      this.logger.warn(
        `Auto-approve skipped for withdrawal ${withdrawal._id}: ${(err as Error).message}`,
      );
    }
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

    const [items, statusAgg] = await Promise.all([
      this.withdrawalModel.find(filter).sort({ createdAt: -1 }).limit(100),
      this.withdrawalModel.aggregate<{ _id: string; count: number; amount: number }>([
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
    ]);
    const riderIds = [...new Set(items.map((item) => item.riderUserId.toString()))];
    const riders = await this.riderModel.find({ userId: { $in: riderIds.map((id) => new Types.ObjectId(id)) } });
    const riderByUserId = new Map(riders.map((r) => [r.userId.toString(), r]));

    const byStatus = new Map(statusAgg.map((s) => [s._id, s]));
    const counts = {
      pending: byStatus.get('pending')?.count ?? 0,
      pendingAmount: byStatus.get('pending')?.amount ?? 0,
      paid: byStatus.get('paid')?.count ?? 0,
      paidAmount: byStatus.get('paid')?.amount ?? 0,
      rejected: byStatus.get('rejected')?.count ?? 0,
      total: statusAgg.reduce((s, r) => s + r.count, 0),
    };

    return {
      success: true,
      data: {
        items: items.map((item) => {
          const rider = riderByUserId.get(item.riderUserId.toString());
          return {
            ...this.serializeWithdrawal(item),
            riderName: rider
              ? `${rider.firstName ?? ''} ${rider.lastName ?? ''}`.trim() || item.riderUserId.toString()
              : item.riderUserId.toString(),
          };
        }),
        counts,
      },
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

    // Atomically claim the withdrawal (only if still pending) before touching the wallet, so two
    // concurrent approve calls for the same withdrawal can't both pass the status check above and
    // both decrement the balance.
    const claimed = await this.withdrawalModel.findOneAndUpdate(
      { _id: withdrawal._id, status: RIDER_WITHDRAWAL_STATUS.PENDING },
      {
        status: RIDER_WITHDRAWAL_STATUS.PAID,
        adminNote,
        processedBy: new Types.ObjectId(adminUserId),
        processedAt: new Date(),
      },
      { new: true },
    );
    if (!claimed) {
      throw new BadRequestException('Withdrawal is not pending');
    }

    // $inc is atomic — can't lose an update if a credit/debit for the same rider lands concurrently.
    await this.riderModel.updateOne(
      { userId: withdrawal.riderUserId },
      { $inc: { walletBalance: -withdrawal.amount } },
    );

    await this.transactionModel.create({
      riderUserId: withdrawal.riderUserId,
      type: 'debit',
      amount: withdrawal.amount,
      reference: `withdrawal:${withdrawal._id.toString()}`,
      description: `Withdrawal paid via ${RIDER_PAYOUT_METHOD_LABELS[withdrawal.method]}`,
    });

    await this.ledgerService.post(
      `withdrawal:${withdrawal._id.toString()}`,
      'withdrawal',
      withdrawal._id.toString(),
      [
        {
          accountType: 'rider_payable',
          accountSubject: withdrawal.riderUserId.toString(),
          direction: 'debit',
          amount: withdrawal.amount,
          description: `Withdrawal liability cleared for rider ${withdrawal.riderUserId.toString()}`,
        },
        {
          accountType: 'cash_out',
          accountSubject: withdrawal.method,
          direction: 'credit',
          amount: withdrawal.amount,
          description: `Cash paid out via ${RIDER_PAYOUT_METHOD_LABELS[withdrawal.method]}`,
        },
      ],
    );

    return { success: true, data: this.serializeWithdrawal(claimed) };
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
    const earningType: RiderEarningType = stage === 'pickup' ? 'pickup' : 'delivery';
    const riderObjectId = new Types.ObjectId(riderUserId);
    const orderObjectId = new Types.ObjectId(orderId);

    // Fetched once, up front: needed for the fee lookup below (employees don't earn a per-task fee).
    const rider = await this.findOrCreateRider(riderUserId);

    if (rider.partnerId) {
      // Partner-owned riders' cash collection is reconciled by their partner, not tracked in the
      // platform's rider remittance ledger.
      return { alreadyNetted: false, remittance: null };
    }

    // The fee is a fixed constant (not looked up from a wallet transaction) so this doesn't
    // depend on creditEarning() having already run — collectCash() fires this before the task
    // is marked complete (where creditEarning() actually runs), so a lookup-based amount would
    // never find a match and would silently skip creating the remittance record every time.
    // Employees are paid a fixed wage, not a per-task fee, so they remit 100% of cash collected.
    let earningOffset = 0;
    if (rider.employmentType !== 'employee') {
      const fees = await this.settingsService.getRiderFeeAmounts();
      earningOffset = riderEarningAmount(
        earningType,
        earningType === 'pickup' ? fees.pickup : fees.delivery,
      );
    }
    const netRemittance = Math.max(0, cashAmount - earningOffset);
    const nettingRef = `netting:${stage}:${orderId}`;

    // Create the remittance record first and let its unique (riderUserId, orderId, stage) index be
    // the idempotency gate — a duplicate insert fails atomically, so two concurrent calls for the
    // same order+stage can never both debit the wallet.
    let remittance: RiderCashRemittanceDocument;
    try {
      remittance = await this.remittanceModel.create({
        riderUserId: riderObjectId,
        orderId: orderObjectId,
        paymentId: new Types.ObjectId(paymentId),
        stage,
        cashAmount,
        earningOffset,
        netRemittance,
        status: 'pending',
      });
    } catch (err) {
      if (this.isDuplicateKeyError(err)) {
        const existing = await this.remittanceModel.findOne({
          riderUserId: riderObjectId,
          orderId: orderObjectId,
          stage,
        });
        return { alreadyNetted: true, remittance: this.serializeRemittance(existing!) };
      }
      throw err;
    }

    if (earningOffset > 0) {
      // Not clamped to 0: this fires before creditEarning() has added the matching task fee to
      // the wallet (collectCash happens mid-task; creditEarning runs once the task is marked
      // complete), so the balance may dip briefly negative here and self-correct moments later.
      // Clamping to 0 would silently donate the rider a phantom credit whenever their balance is
      // currently below the fee amount. $inc is atomic, so this can't race with a concurrent
      // credit/debit for the same rider the way a fetch-mutate-save would.
      await this.riderModel.updateOne(
        { userId: riderObjectId },
        { $inc: { walletBalance: -earningOffset } },
      );
      await this.transactionModel.create({
        riderUserId: riderObjectId,
        type: 'netting',
        amount: earningOffset,
        reference: nettingRef,
        description: `Fee offset against cash collected at ${stage} · order ${orderId.slice(-6)}`,
      });
    }

    if (netRemittance > 0) {
      await this.ledgerService.post(
        `remittance-created:${remittance._id.toString()}`,
        'remittance',
        remittance._id.toString(),
        [
          {
            accountType: 'rider_remittance_receivable',
            accountSubject: riderUserId,
            direction: 'debit',
            amount: netRemittance,
            description: `Cash collected by rider ${riderUserId} pending remittance (order ${orderId.slice(-6)})`,
          },
          {
            accountType: 'order_revenue_clearing',
            direction: 'credit',
            amount: netRemittance,
            description: `Order revenue recognized from cash collection (order ${orderId.slice(-6)})`,
          },
        ],
      );
    }

    return { alreadyNetted: false, remittance: this.serializeRemittance(remittance) };
  }

  async submitRemittance(
    riderUserId: string,
    proofImageUrl?: string,
    transactionId?: string,
    mode: 'net_of_fee' | 'full_amount' = 'net_of_fee',
  ) {
    if (mode !== 'net_of_fee' && mode !== 'full_amount') {
      throw new BadRequestException('Invalid remittance mode');
    }
    const riderObjectId = new Types.ObjectId(riderUserId);
    const candidates = await this.remittanceModel.find({
      riderUserId: riderObjectId,
      status: 'pending',
    });
    if (candidates.length === 0) throw new NotFoundException('No pending cash remittances to submit');

    // Atomic per-item claim: two overlapping submitRemittance calls (double-tap, a retried request
    // after a client timeout) must not both process the same remittance — that would double the
    // full_amount wallet credit-back and ledger topup below. Each findOneAndUpdate re-checks
    // status:'pending' at write time, so only one caller can win a given item.
    const claimed = await Promise.all(
      candidates.map((item) =>
        this.remittanceModel.findOneAndUpdate(
          { _id: item._id, status: 'pending' },
          {
            status: 'submitted',
            submittedAt: new Date(),
            remittanceMode: mode,
            ...(proofImageUrl && { proofImageUrl }),
            ...(transactionId && { transactionId }),
          },
          { new: true },
        ),
      ),
    );
    const items = claimed.filter((item): item is NonNullable<typeof item> => item !== null);
    if (items.length === 0) throw new NotFoundException('No pending cash remittances to submit');

    // Declared here rather than at collection, because collection happens mid-task before the
    // rider knows whether they'll keep the fee in cash or hand it all over — netEarningsAgainstCash
    // always assumes 'net_of_fee' as a placeholder. If the rider now says otherwise, true up the
    // wallet debit and the receivable/clearing entries it posted so the books match what's actually
    // changing hands.
    if (mode === 'full_amount') {
      for (const item of items) {
        if (item.earningOffset <= 0) continue;

        // Give back the fee that was tentatively deducted from the wallet at collection time —
        // the rider is now remitting it in cash instead of keeping it.
        await this.riderModel.updateOne(
          { userId: riderObjectId },
          { $inc: { walletBalance: item.earningOffset } },
        );
        await this.transactionModel.create({
          riderUserId: riderObjectId,
          type: 'release',
          amount: item.earningOffset,
          reference: `netting-reversal:${item.stage}:${item.orderId.toString()}`,
          description: `Fee netting reversed — remitting full cash for order ${item.orderId.toString().slice(-6)}`,
        });

        // Top up the collection-time posting (which only booked netRemittance) so the receivable
        // and clearing accounts reflect the full cashAmount now expected back.
        await this.ledgerService.post(
          `remittance-topup:${item._id.toString()}`,
          'remittance',
          item._id.toString(),
          [
            {
              accountType: 'rider_remittance_receivable',
              accountSubject: riderUserId,
              direction: 'debit',
              amount: item.earningOffset,
              description: `Full-amount remittance declared — receivable topped up for order ${item.orderId.toString().slice(-6)}`,
            },
            {
              accountType: 'order_revenue_clearing',
              direction: 'credit',
              amount: item.earningOffset,
              description: `Order revenue recognized from cash collection top-up (order ${item.orderId.toString().slice(-6)})`,
            },
          ],
        );
      }
    }

    const totalRemitted = items.reduce(
      (s, r) => s + (mode === 'full_amount' ? r.cashAmount : r.netRemittance),
      0,
    );

    return {
      success: true,
      data: {
        submittedCount: items.length,
        totalNetRemittance: totalRemitted,
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

    for (const item of items) {
      // net_of_fee: receivable was posted at collection for netRemittance only.
      // full_amount: submitRemittance() already topped up the receivable by earningOffset, so the
      // full cashAmount is what's outstanding and what's actually being handed over now.
      const amountReceived = item.remittanceMode === 'full_amount' ? item.cashAmount : item.netRemittance;
      if (amountReceived <= 0) continue;
      await this.ledgerService.post(
        `remittance:${item._id.toString()}`,
        'remittance',
        item._id.toString(),
        [
          {
            accountType: 'platform_cash',
            direction: 'debit',
            amount: amountReceived,
            description: `Cash remittance received from rider ${item.riderUserId.toString()} (order ${item.orderId.toString().slice(-6)})`,
          },
          {
            accountType: 'rider_remittance_receivable',
            accountSubject: item.riderUserId.toString(),
            direction: 'credit',
            amount: amountReceived,
            description: `Remittance receivable cleared for rider ${item.riderUserId.toString()}`,
          },
        ],
      );
    }

    const totalVerified = items.reduce(
      (s, r) => s + (r.remittanceMode === 'full_amount' ? r.cashAmount : r.netRemittance),
      0,
    );
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
      remittanceMode: r.remittanceMode,
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
