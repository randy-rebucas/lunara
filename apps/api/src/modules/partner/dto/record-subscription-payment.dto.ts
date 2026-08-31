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
}
