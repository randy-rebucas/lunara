import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PartnerSettlement, PartnerSettlementDocument } from '../partner/schemas/partner-settlement.schema';
import { RiderWithdrawal, RiderWithdrawalDocument } from '../riders/schemas/rider-wallet.schema';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { RefundRequest, RefundRequestDocument, RefundStatus } from '../refunds/schemas/refund-request.schema';
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
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(RefundRequest.name) private refundModel: Model<RefundRequestDocument>,
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
    const riderWageCost  = -get('rider_wage_expense');    // expense account: debits increase it
    const refundCost     = -get('refund_expense');         // expense account: debits increase it
    const netMargin = platformRevenue - riderCost - riderWageCost - refundCost;

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
        riderWageCost,
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

  /**
   * Accounting overview: monthly P&L trend (revenue/expenses/net profit), current-month cash
   * flow in/out, and the most recent posted journal entries — all derived from real ledger data.
   * No chart-of-accounts, manual journal entry, or fiscal-year config exists yet, so this only
   * covers what the ledger actually tracks.
   */
  async getAccountingOverview(months = 6, recentLimit = 20) {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const monthlyAgg = await this.entryModel.aggregate<{
      _id: { year: number; month: number; accountType: LedgerAccountType };
      credit: number;
      debit: number;
    }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            accountType: '$accountType',
          },
          credit: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0] } },
          debit: { $sum: { $cond: [{ $eq: ['$direction', 'debit'] }, '$amount', 0] } },
        },
      },
    ]);

    const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;
    const buckets = new Map<
      string,
      { revenue: number; expenses: number; cashIn: number; cashOut: number }
    >();
    for (let i = 0; i < months; i++) {
      const d = new Date(since);
      d.setMonth(d.getMonth() + i);
      buckets.set(monthKey(d.getFullYear(), d.getMonth() + 1), {
        revenue: 0,
        expenses: 0,
        cashIn: 0,
        cashOut: 0,
      });
    }

    const expenseAccounts = new Set(['rider_payout_expense', 'rider_wage_expense', 'refund_expense']);
    for (const row of monthlyAgg) {
      const key = monthKey(row._id.year, row._id.month);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (row._id.accountType === 'platform_revenue') bucket.revenue += row.credit;
      if (expenseAccounts.has(row._id.accountType)) bucket.expenses += row.debit;
      if (row._id.accountType === 'platform_cash') bucket.cashIn += row.debit;
      if (row._id.accountType === 'cash_out') bucket.cashOut += row.credit;
    }

    const trend = [...buckets.entries()].map(([key, b]) => ({
      month: key,
      revenue: b.revenue,
      expenses: b.expenses,
      netProfit: b.revenue - b.expenses,
      cashIn: b.cashIn,
      cashOut: b.cashOut,
      netCashFlow: b.cashIn - b.cashOut,
    }));

    const currentMonth = trend[trend.length - 1] ?? {
      cashIn: 0,
      cashOut: 0,
      netCashFlow: 0,
    };

    const recentEntries = await this.entryModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(recentLimit)
      .lean();

    return {
      trend,
      cashFlow: {
        cashIn: currentMonth.cashIn,
        cashOut: currentMonth.cashOut,
        net: currentMonth.netCashFlow,
      },
      recentEntries: recentEntries.map((e) => ({
        id: e._id.toString(),
        date: e.createdAt,
        transactionRef: e.transactionRef,
        sourceType: e.sourceType,
        accountType: e.accountType,
        description: e.description,
        direction: e.direction,
        amount: e.amount,
      })),
    };
  }

  /**
   * Per-transaction reconciliation: each cash-moving source record (payment, partner payout,
   * rider payout, refund) checked against whether its ledger transaction actually posted.
   * Under normal operation every one of these should be matched — LedgerService.post is called
   * synchronously in the same flow that marks the source record paid/processed — so an unmatched
   * row here means that flow partially failed (source updated, ledger post didn't).
   */
  async getReconciliationTransactions(limit = 300) {
    const perTypeLimit = Math.ceil(limit / 4);

    const [payments, settlements, withdrawals, refunds] = await Promise.all([
      this.paymentModel
        .find({ status: 'paid' })
        .sort({ paidAt: -1 })
        .limit(perTypeLimit)
        .select('amount method orderId purpose paidAt receiptCode')
        .lean(),
      this.settlementModel
        .find({ status: 'paid' })
        .sort({ paidAt: -1 })
        .limit(perTypeLimit)
        .select('partnerPayout partnerId paidAt')
        .lean(),
      this.withdrawalModel
        .find({ status: 'paid' })
        .sort({ processedAt: -1 })
        .limit(perTypeLimit)
        .select('amount method riderUserId processedAt')
        .lean(),
      this.refundModel
        .find({ status: { $in: [RefundStatus.PROCESSED, RefundStatus.CLOSED] }, processedAt: { $ne: null } })
        .sort({ processedAt: -1 })
        .limit(perTypeLimit)
        .select('approvedAmount requestedAmount orderId processedAt')
        .lean(),
    ]);

    const refs = [
      ...payments.map((p) => `payment:${p._id.toString()}`),
      ...settlements.map((s) => `settlement:${s._id.toString()}`),
      ...withdrawals.map((w) => `withdrawal:${w._id.toString()}`),
      ...refunds.map((r) => `refund:${r._id.toString()}`),
    ];

    const ledgerRows = await this.entryModel
      .find({ transactionRef: { $in: refs } })
      .select('transactionRef direction amount')
      .lean();
    const ledgerByRef = new Map<string, number>();
    for (const row of ledgerRows) {
      // Only the "primary" side of each balanced pair, so summing doesn't double the amount —
      // credits and debits within a transactionRef are equal by construction (post() enforces it).
      if (row.direction === 'credit') {
        ledgerByRef.set(row.transactionRef, (ledgerByRef.get(row.transactionRef) ?? 0) + row.amount);
      }
    }

    type Row = {
      id: string;
      date: Date;
      type: 'payment' | 'payout' | 'fee' | 'refund';
      typeLabel: string;
      reference: string;
      source: string;
      amount: number;
      matched: boolean;
      matchedWith: string | null;
      difference: number;
    };

    const rows: Row[] = [];

    for (const p of payments) {
      const ref = `payment:${p._id.toString()}`;
      const ledgerAmount = ledgerByRef.get(ref);
      const matched = ledgerAmount != null && Math.round(ledgerAmount) === Math.round(p.amount);
      rows.push({
        id: p._id.toString(),
        date: p.paidAt ?? p._id.getTimestamp(),
        type: 'payment',
        typeLabel: p.purpose === 'wallet_topup' ? 'Wallet top-up' : 'Customer payment',
        reference: p.receiptCode || `PAY-${p._id.toString().slice(-8).toUpperCase()}`,
        source: p.method,
        amount: p.amount,
        matched,
        matchedWith: matched ? ref : null,
        difference: matched ? 0 : p.amount,
      });
    }

    for (const s of settlements) {
      const ref = `settlement:${s._id.toString()}`;
      const ledgerAmount = ledgerByRef.get(ref);
      const matched = ledgerAmount != null;
      rows.push({
        id: s._id.toString(),
        date: s.paidAt ?? s._id.getTimestamp(),
        type: 'payout',
        typeLabel: 'Partner payout',
        reference: `SETTLE-${s._id.toString().slice(-8).toUpperCase()}`,
        source: 'Partner settlement',
        amount: -s.partnerPayout,
        matched,
        matchedWith: matched ? ref : null,
        difference: matched ? 0 : -s.partnerPayout,
      });
    }

    for (const w of withdrawals) {
      const ref = `withdrawal:${w._id.toString()}`;
      const ledgerAmount = ledgerByRef.get(ref);
      const matched = ledgerAmount != null;
      rows.push({
        id: w._id.toString(),
        date: w.processedAt ?? w._id.getTimestamp(),
        type: 'payout',
        typeLabel: 'Rider payout',
        reference: `WD-${w._id.toString().slice(-8).toUpperCase()}`,
        source: w.method,
        amount: -w.amount,
        matched,
        matchedWith: matched ? ref : null,
        difference: matched ? 0 : -w.amount,
      });
    }

    for (const r of refunds) {
      const ref = `refund:${r._id.toString()}`;
      const ledgerAmount = ledgerByRef.get(ref);
      const amount = r.approvedAmount ?? r.requestedAmount;
      const matched = ledgerAmount != null;
      rows.push({
        id: r._id.toString(),
        date: r.processedAt ?? r._id.getTimestamp(),
        type: 'refund',
        typeLabel: 'Customer refund',
        reference: `REF-${r._id.toString().slice(-8).toUpperCase()}`,
        source: 'Wallet credit',
        amount: -amount,
        matched,
        matchedWith: matched ? ref : null,
        difference: matched ? 0 : -amount,
      });
    }

    rows.sort((a, b) => b.date.getTime() - a.date.getTime());
    const limited = rows.slice(0, limit);

    const matchedRows = limited.filter((r) => r.matched);
    const unmatchedRows = limited.filter((r) => !r.matched);
    const totalAmount = limited.reduce((s, r) => s + Math.abs(r.amount), 0);
    const matchedAmount = matchedRows.reduce((s, r) => s + Math.abs(r.amount), 0);
    const unmatchedAmount = unmatchedRows.reduce((s, r) => s + Math.abs(r.amount), 0);

    const byType = {
      payment: limited.filter((r) => r.type === 'payment').reduce((s, r) => s + Math.abs(r.amount), 0),
      payout: limited.filter((r) => r.type === 'payout').reduce((s, r) => s + Math.abs(r.amount), 0),
      refund: limited.filter((r) => r.type === 'refund').reduce((s, r) => s + Math.abs(r.amount), 0),
    };

    return {
      items: limited.map((r) => ({ ...r, date: r.date.toISOString() })),
      summary: {
        total: limited.length,
        totalAmount,
        matchedCount: matchedRows.length,
        matchedAmount,
        unmatchedCount: unmatchedRows.length,
        unmatchedAmount,
        difference: unmatchedAmount,
      },
      breakdown: byType,
    };
  }
}
