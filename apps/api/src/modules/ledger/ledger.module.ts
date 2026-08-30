import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PartnerSettlement, PartnerSettlementSchema } from '../partner/schemas/partner-settlement.schema';
import { PartnerInvoice, PartnerInvoiceSchema } from '../partner/schemas/partner-invoice.schema';
import { RiderWithdrawal, RiderWithdrawalSchema } from '../riders/schemas/rider-wallet.schema';
import { Wallet, WalletSchema } from '../wallets/schemas/wallet.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { RefundRequest, RefundRequestSchema } from '../refunds/schemas/refund-request.schema';
import {
  LedgerEntry,
  LedgerEntrySchema,
  LedgerTransactionMarker,
  LedgerTransactionMarkerSchema,
} from './schemas/ledger-entry.schema';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
      { name: LedgerTransactionMarker.name, schema: LedgerTransactionMarkerSchema },
      { name: PartnerSettlement.name, schema: PartnerSettlementSchema },
      { name: PartnerInvoice.name, schema: PartnerInvoiceSchema },
      { name: RiderWithdrawal.name, schema: RiderWithdrawalSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: RefundRequest.name, schema: RefundRequestSchema },
    ]),
  ],
  controllers: [LedgerController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
