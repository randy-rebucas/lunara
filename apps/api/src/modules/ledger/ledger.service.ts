import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PartnerSettlement, PartnerSettlementDocument } from '../partner/schemas/partner-settlement.schema';
import { RiderWithdrawal, RiderWithdrawalDocument } from '../riders/schemas/rider-wallet.schema';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import {
  LedgerAccountType,
  LedgerEntry,
  LedgerEntryDocument,
  LedgerTransactionMarker,
  LedgerTransactionMarkerDocument,
} from './schemas/ledger-entry.schema';

export interface LedgerLine {
  accountType: LedgerAccountType;
  accountSubject?: string;
  direction: 'debit' | 'credit';
  amount: number;
  description: string;
}

@Injectable()
export class LedgerService {
  constructor(
    @InjectModel(LedgerEntry.name) private entryModel: Model<LedgerEntryDocument>,
    @InjectModel(LedgerTransactionMarker.name)
    private markerModel: Model<LedgerTransactionMarkerDocument>,
    @InjectModel(PartnerSettlement.name) private settlementModel: Model<PartnerSettlementDocument>,
    @InjectModel(RiderWithdrawal.name) private withdrawalModel: Model<RiderWithdrawalDocument>,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
  ) {}

  /**
   * Posts a balanced double-entry transaction. Throws if debits != credits,
   * so a bug in calling code fails loudly instead of silently corrupting the ledger.
   */
  async post(
    transactionRef: string,
    sourceType: LedgerEntry['sourceType'],
    sourceId: string,
    lines: LedgerLine[],
  ) {
    const debits = lines.filter((l) => l.direction === 'debit').reduce((s, l) => s + l.amount, 0);
    const credits = lines.filter((l) => l.direction === 'credit').reduce((s, l) => s + l.amount, 0);
    if (Math.round(debits) !== Math.round(credits)) {
      throw new BadRequestException(
        `Unbalanced ledger transaction ${transactionRef}: debits=${debits} credits=${credits}`,
      );
    }

    // Reserve the ref via a uniquely-indexed marker first, so concurrent posts of the same
    // transactionRef race on the DB's unique index instead of a check-then-act read.
    try {
      await this.markerModel.create({ transactionRef });
    } catch (err) {
      if (this.isDuplicateKeyError(err)) return; // idempotent: already posted
      throw err;
    }

    await this.entryModel.insertMany(
      lines.map((l) => ({
        transactionRef,
        sourceType,
        sourceId,
        accountType: l.accountType,
        accountSubject: l.accountSubject ?? '',
        direction: l.direction,
        amount: l.amount,
        description: l.description,
      })),
    );
  }

  /**
   * Reverses a previously posted transaction by re-posting its lines with direction flipped,
   * under a new transactionRef. No-ops if the original transaction was never posted, so callers
   * can safely call this to unwind a failure regardless of how far the forward flow got.
   */
  async reverse(
    originalRef: string,
    reversalRef: string,
    sourceType: LedgerEntry['sourceType'],
    sourceId: string,
  ) {
    const originalLines = await this.entryModel.find({ transactionRef: originalRef });
    if (originalLines.length === 0) return;

    await this.post(
      reversalRef,
      sourceType,
      sourceId,
      originalLines.map((l) => ({
        accountType: l.accountType,
        accountSubject: l.accountSubject || undefined,
        direction: l.direction === 'debit' ? 'credit' : 'debit',
        amount: l.amount,
        description: `Reversal of ${originalRef}: ${l.description}`,
      })),
    );
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
  }

  /** Net balance of an account: credits minus debits (positive = platform owes this party). */
  async getAccountBalance(accountType: LedgerAccountType, accountSubject = '') {
    const [result] = await this.entryModel.aggregate<{ balance: number }>([
      { $match: { accountType, accountSubject } },
      {
        $group: {
          _id: null,
          balance: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', { $multiply: ['$amount', -1] }],
            },
          },
        },
      },
    ]);
    return result?.balance ?? 0;
  }

  /** Full revenue reconciliation snapshot: ledger vs DB cross-checks and P&L summary. */
  async getReconciliation() {
    // ── Ledger aggregate per account type (platform-level, no subject split) ──
    const ledgerTotals = await this.entryModel.aggregate<{ _id: LedgerAccountType; balance: number }>([
      {
        $group: {
          _id: '$accountType',
          balance: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', { $multiply: ['$amount', -1] }],
            },
          },
        },
      },
    ]);
    const ledger = Object.fromEntries(ledgerTotals.map((r) => [r._id, r.balance])) as Record<string, number>;
    const get = (key: string) => ledger[key] ?? 0;

    // ── DB aggregates ──
    const [settlementAgg] = await this.settlementModel.aggregate<{
      totalRevenue: number;
      totalLunaraFee: number;
      totalPartnerPayout: number;
      paidCount: number;
      pendingCount: number;
    }>([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalLunaraFee: { $sum: '$lunaraFee' },
          totalPartnerPayout: { $sum: '$partnerPayout' },
          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
          pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        },
      },
    ]);

    const [withdrawalAgg] = await this.withdrawalModel.aggregate<{
      totalPaid: number;
      paidCount: number;
      pendingTotal: number;
      pendingCount: number;
    }>([
      {
        $group: {
          _id: null,
          totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
          pendingTotal: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
          pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        },
      },
    ]);

    const [walletAgg] = await this.walletModel.aggregate<{ totalBalance: number; walletCount: number }>([
      { $group: { _id: null, totalBalance: { $sum: '$balance' }, walletCount: { $sum: 1 } } },
    ]);

    const db = {
      settlements: settlementAgg ?? { totalRevenue: 0, totalLunaraFee: 0, totalPartnerPayout: 0, paidCount: 0, pendingCount: 0 },
      withdrawals: withdrawalAgg ?? { totalPaid: 0, paidCount: 0, pendingTotal: 0, pendingCount: 0 },
      wallets: walletAgg ?? { totalBalance: 0, walletCount: 0 },
    };

    // ── P&L summary ──
    // Revenue/liability accounts: get() = credits − debits = natural positive balance ✓
    // Asset/expense accounts: get() = credits − debits = NEGATIVE of natural balance → negate
    const platformRevenue = get('platform_revenue');
    const riderCost      = -get('rider_payout_expense');  // expense account: debits increase it
    const refundCost     = -get('refund_expense');         // expense account: debits increase it
    const netMargin = platformRevenue - riderCost - refundCost;

    // ── Cash flow ──
    const cashIn  = -get('platform_cash');  // asset account: debits = cash received → negate
    const cashOut =  get('cash_out');       // liability-like: credits = cash paid out ✓

    // ── Spot checks ──
    const clearingDrift = get('order_revenue_clearing'); // liability-like, should converge to 0
    const commissionDrift = platformRevenue - db.settlements.totalLunaraFee;
    const cashOutDrift = cashOut - (db.settlements.totalPartnerPayout + db.withdrawals.totalPaid);
    // Ledger customer_wallet_liability sum vs actual wallet balances
    const walletLedgerTotal = get('customer_wallet_liability');
    const walletDbTotal = db.wallets.totalBalance;
    const walletDrift = walletLedgerTotal - walletDbTotal;

    return {
      pnl: {
        platformRevenue,
        riderCost,
        refundCost,
        netMargin,
      },
      cashFlow: {
        cashIn,
        cashOut,
        net: cashIn - cashOut,
      },
      settlements: {
        count: db.settlements.paidCount + db.settlements.pendingCount,
        paidCount: db.settlements.paidCount,
        pendingCount: db.settlements.pendingCount,
        totalRevenue: db.settlements.totalRevenue,
        totalLunaraFee: db.settlements.totalLunaraFee,
        totalPartnerPayout: db.settlements.totalPartnerPayout,
      },
      riderWithdrawals: {
        paidCount: db.withdrawals.paidCount,
        totalPaid: db.withdrawals.totalPaid,
        pendingCount: db.withdrawals.pendingCount,
        pendingTotal: db.withdrawals.pendingTotal,
        riderPayableBalance: get('rider_payable'),
        riderRemittanceReceivable: -get('rider_remittance_receivable'), // asset: negate
      },
      wallets: {
        count: db.wallets.walletCount,
        ledgerLiability: walletLedgerTotal,
        actualBalance: walletDbTotal,
        drift: walletDrift,
      },
      spotChecks: {
        clearingDrift,
        commissionDrift,
        cashOutDrift,
        walletDrift,
      },
    };
  }

  /** Sum of credits minus debits per account, for reconciliation against PartnerSettlement/RiderWithdrawal totals. */
  async getTrialBalance() {
    const rows = await this.entryModel.aggregate<{
      _id: { accountType: LedgerAccountType; accountSubject: string };
      balance: number;
    }>([
      {
        $group: {
          _id: { accountType: '$accountType', accountSubject: '$accountSubject' },
          balance: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', { $multiply: ['$amount', -1] }],
            },
          },
        },
      },
      { $sort: { '_id.accountType': 1, '_id.accountSubject': 1 } },
    ]);

    return rows.map((r) => ({
      accountType: r._id.accountType,
      accountSubject: r._id.accountSubject,
      balance: r.balance,
    }));
  }
}
