import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
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
}

export class ConfirmPaymentDto {
  @IsOptional()
  @IsString()
  externalId?: string;
}
