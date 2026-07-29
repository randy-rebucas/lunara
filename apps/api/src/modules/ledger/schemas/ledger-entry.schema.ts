import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LedgerEntryDocument = HydratedDocument<LedgerEntry>;

export const LEDGER_ACCOUNT_TYPES = [
  'order_revenue_clearing',
  'platform_revenue',
  'partner_payable',
  'rider_payable',
  'rider_remittance_receivable',
  'cash_out',
  'platform_cash',
  'rider_payout_expense',
  'rider_wage_expense',
  'customer_wallet_liability',
  'refund_expense',
  'payment_processing_expense',
] as const;
export type LedgerAccountType = (typeof LEDGER_ACCOUNT_TYPES)[number];

/**
 * One line of a double-entry transaction. A transaction is the set of all
 * entries sharing the same transactionRef; debits must equal credits within
 * that set (enforced by LedgerService.post, not by the schema itself).
 */
@Schema({ timestamps: true, collection: 'ledger_entries' })
export class LedgerEntry {
  /** Groups entries that were posted together as one balanced transaction. */
  @Prop({ required: true, index: true })
  transactionRef!: string;

  @Prop({ required: true, enum: LEDGER_ACCOUNT_TYPES, index: true })
  accountType!: LedgerAccountType;

  /** Subject of the account, e.g. partnerId or riderUserId as a string. Empty for platform-wide accounts. */
  @Prop({ default: '', index: true })
  accountSubject!: string;

  @Prop({ required: true, enum: ['debit', 'credit'] })
  direction!: 'debit' | 'credit';

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true })
  description!: string;

  /** What real-world record this line documents, for traceability. */
  @Prop({
    required: true,
    enum: [
      'settlement',
      'settlement_clawback',
      'remittance',
      'withdrawal',
      'rider_earning',
      'payment',
      'refund',
      'wallet_topup',
      'chargeback',
    ],
  })
  sourceType!:
    | 'settlement'
    | 'settlement_clawback'
    | 'remittance'
    | 'withdrawal'
    | 'rider_earning'
    | 'payment'
    | 'refund'
    | 'wallet_topup'
    | 'chargeback';

  @Prop({ required: true })
  sourceId!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntry);
LedgerEntrySchema.index({ accountType: 1, accountSubject: 1 });

export type LedgerTransactionMarkerDocument = HydratedDocument<LedgerTransactionMarker>;

/**
 * One row per posted transactionRef, with a unique index. Inserted before the entry lines
 * so concurrent posts of the same ref race on the unique index instead of a check-then-act
 * findOne, closing the double-post window that would otherwise exist in LedgerService.post.
 */
@Schema({ timestamps: true, collection: 'ledger_transaction_markers' })
export class LedgerTransactionMarker {
  @Prop({ required: true, unique: true })
  transactionRef!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const LedgerTransactionMarkerSchema = SchemaFactory.createForClass(LedgerTransactionMarker);
