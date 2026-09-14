import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class RecordSubscriptionPaymentDto {
  @IsNumber()
  @IsPositive()
  amountPhp!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Client-generated key (e.g. a UUID minted once when the record-payment form opens) so a
   * retried/double-clicked submission doesn't advance the billing period or post to the ledger
   * twice. Optional for backward compatibility, but the admin-web form always sends one. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}
