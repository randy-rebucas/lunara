import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { formatCurrency } from '@lunara/utils';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationDispatchService } from '../push/notification-dispatch.service';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Transaction, TransactionDocument, Wallet, WalletDocument } from './schemas/wallet.schema';

/** Round to the nearest centavo to keep repeated $inc mutations from drifting off-cent. */
function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    private ledgerService: LedgerService,
    private notificationDispatch: NotificationDispatchService,
  ) {}

  async findOrCreate(userId: string) {
    const wallet = await this.walletModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), balance: 0, currency: 'PHP' } },
      { upsert: true, new: true },
    );
    return wallet!;
  }

  async getWallet(userId: string) {
    const wallet = await this.findOrCreate(userId);
    return { success: true, data: wallet };
  }

  async getTransactions(userId: string) {
    const wallet = await this.findOrCreate(userId);
    const items = await this.transactionModel
      .find({ walletId: wallet._id })
      .sort({ createdAt: -1 })
      .limit(50);
    return { success: true, data: items };
  }

  /**
   * Dev-only instant top-up when PayMongo is not configured.
   * Production top-ups go through POST /payments/wallet-topup/intent.
   */
  async topUp(userId: string, amount: number) {
    if (process.env.NODE_ENV === 'production' || process.env.PAYMONGO_SECRET_KEY?.trim()) {
      throw new BadRequestException(
        'Use POST /payments/wallet-topup/intent to top up via PayMongo (GCash, Maya, or card).',
      );
    }

    const ref = `topup-dev-${userId}-${Date.now()}`;
    // Reuses the same atomic $inc + reference-idempotent credit() used for real top-ups, instead
    // of `wallet.balance += amount; wallet.save()` — that fetch-mutate-save form can lose an
    // update if two credits/debits for this wallet land concurrently.
    const wallet = await this.credit(userId, amount, ref, 'Wallet top-up (dev)');
    await this.ledgerService.post(ref, 'wallet_topup', userId, [
      {
        accountType: 'platform_cash',
        direction: 'debit',
        amount,
        description: `Dev wallet top-up for user ${userId}`,
      },
      {
        accountType: 'customer_wallet_liability',
        accountSubject: userId,
        direction: 'credit',
        amount,
        description: `Dev wallet top-up credited to user ${userId}`,
      },
    ]);
    return { success: true, data: wallet };
  }

  async debit(userId: string, rawAmount: number, reference: string, description: string) {
    const amount = roundCurrency(rawAmount);
    const wallet = await this.findOrCreate(userId);

    // Reserve the reference first so a concurrent duplicate call fails fast on the unique index.
    try {
      await this.transactionModel.create({
        walletId: wallet._id,
        type: 'debit',
        amount,
        reference,
        description,
      });
    } catch (err) {
      if (this.isDuplicateKeyError(err)) {
        return this.findOrCreate(userId);
      }
      throw err;
    }

    const updated = await this.walletModel.findOneAndUpdate(
      { _id: wallet._id, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true },
    );
    if (!updated) {
      // Roll back the reserved transaction record — insufficient balance at debit time.
      await this.transactionModel.deleteOne({ walletId: wallet._id, reference });
      throw new BadRequestException('Insufficient wallet balance');
    }
    this.notifyBalanceChange(userId, 'debit', amount, description, updated.balance, updated.currency);
    return updated;
  }

  async credit(userId: string, rawAmount: number, reference: string, description: string) {
    const amount = roundCurrency(rawAmount);
    const wallet = await this.findOrCreate(userId);

    try {
      await this.transactionModel.create({
        walletId: wallet._id,
        type: 'credit',
        amount,
        reference,
        description,
      });
    } catch (err) {
      if (this.isDuplicateKeyError(err)) {
        return this.findOrCreate(userId);
      }
      throw err;
    }

    const updated = await this.walletModel.findOneAndUpdate(
      { _id: wallet._id },
      { $inc: { balance: amount } },
      { new: true },
    );
    this.notifyBalanceChange(userId, 'credit', amount, description, updated!.balance, updated!.currency);
    return updated!;
  }

  /** Mirrors customer-order-notification.service.ts's getPreferences() so wallet notifications
   * respect the same push opt-out as order notifications instead of always pushing. */
  private async wantsPush(userId: string): Promise<boolean> {
    const customer = await this.customerModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .select('notificationPreferences')
      .lean();
    return customer?.notificationPreferences?.push ?? true;
  }

  private notifyBalanceChange(
    userId: string,
    type: 'credit' | 'debit',
    amount: number,
    description: string,
    newBalance: number,
    currency: string,
  ) {
    const title = type === 'credit' ? 'Wallet credited' : 'Wallet debited';
    const body = `${type === 'credit' ? '+' : '-'}${formatCurrency(amount, currency)} · ${description}. New balance: ${formatCurrency(newBalance, currency)}.`;
    void this.wantsPush(userId)
      .then((sendPush) =>
        this.notificationDispatch.dispatch({
          userId,
          title,
          body,
          channelId: 'wallet',
          sendPush,
          data: { type: 'wallet_update', walletChangeType: type, amount, balance: newBalance },
        }),
      )
      .catch(() => {});
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
  }
}
