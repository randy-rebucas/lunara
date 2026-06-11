import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@lunara/types';

export class CreatePaymentIntentDto {
  @IsString()
  orderId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  /** Required when method is cash — pay on pickup or delivery */
  @IsOptional()
  @IsIn(['pickup', 'delivery'])
  cashTiming?: 'pickup' | 'delivery';

  /** e.g. window.location.origin — used for PayMongo success/cancel redirects */
  @IsOptional()
  @IsString()
  clientOrigin?: string;
}

export class CreateWalletTopupIntentDto {
  @IsNumber()
  @Min(100)
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  clientOrigin?: string;
}

export class ConfirmPaymentDto {
  @IsOptional()
  @IsString()
  externalId?: string;
}
