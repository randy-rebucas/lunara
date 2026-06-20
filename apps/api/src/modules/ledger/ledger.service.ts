import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LedgerAccountType,
  LedgerEntry,
  LedgerEntryDocument,
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

    const existing = await this.entryModel.findOne({ transactionRef });
    if (existing) return; // idempotent: settlement/remittance/withdrawal already posted

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
