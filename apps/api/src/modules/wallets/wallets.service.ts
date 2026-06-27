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
    if (process.env.PAYMONGO_SECRET_KEY?.trim()) {
      throw new BadRequestException(
        'Use POST /payments/wallet-topup/intent to top up via PayMongo (GCash, Maya, or card).',
      );
    }

    const ref = `topup-dev-${userId}-${Date.now()}`;
    const wallet = await this.findOrCreate(userId);
    wallet.balance += amount;
    await wallet.save();
    await this.transactionModel.create({
      walletId: wallet._id,
      type: 'credit',
      amount,
      reference: ref,
      description: 'Wallet top-up (dev)',
    });
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
    if (wallet.balance < amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }
    wallet.balance -= amount;
    await wallet.save();
    await this.transactionModel.create({
      walletId: wallet._id,
      type: 'debit',
      amount,
      reference,
      description,
    });
    return wallet;
  }

  async credit(userId: string, amount: number, reference: string, description: string) {
    const existing = await this.transactionModel.findOne({ reference });
    if (existing) {
      return this.findOrCreate(userId);
    }

    const wallet = await this.findOrCreate(userId);
    wallet.balance += amount;
    await wallet.save();
    await this.transactionModel.create({
      walletId: wallet._id,
      type: 'credit',
      amount,
      reference,
      description,
    });
    return wallet;
  }
}
