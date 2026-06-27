import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PartnerSettlement, PartnerSettlementSchema } from '../partner/schemas/partner-settlement.schema';
import { RiderWithdrawal, RiderWithdrawalSchema } from '../riders/schemas/rider-wallet.schema';
import { Wallet, WalletSchema } from '../wallets/schemas/wallet.schema';
import { LedgerEntry, LedgerEntrySchema } from './schemas/ledger-entry.schema';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
      { name: PartnerSettlement.name, schema: PartnerSettlementSchema },
      { name: RiderWithdrawal.name, schema: RiderWithdrawalSchema },
      { name: Wallet.name, schema: WalletSchema },
    ]),
  ],
  controllers: [LedgerController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
