import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkInvoicePaidDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
