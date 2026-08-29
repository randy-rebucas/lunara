import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LedgerService } from '../ledger/ledger.service';
import { Transaction, TransactionDocument, Wallet, WalletDocument } from './schemas/wallet.schema';

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    private ledgerService: LedgerService,
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

  async debit(userId: string, amount: number, reference: string, description: string) {
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
    return updated;
  }

  async credit(userId: string, amount: number, reference: string, description: string) {
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
    return updated!;
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
  }
}
