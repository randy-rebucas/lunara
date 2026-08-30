import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsArray()
  @IsString({ each: true })
  orderIds!: string[];

  @IsOptional()
  @IsString()
  adminNote?: string;

  /** Opt-in: deduct this partner's outstanding credit balance (unrecovered post-invoice refund
   * credits from earlier invoices) from this new invoice's amountDue. */
  @IsOptional()
  @IsBoolean()
  applyCredit?: boolean;
}
