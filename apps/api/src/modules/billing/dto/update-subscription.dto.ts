import { IsBoolean, IsDateString, IsIn, IsMongoId, IsOptional, IsString } from 'class-validator';
import { SUBSCRIPTION_STATUSES, SubscriptionStatus } from '../schemas/subscription.schema';

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsMongoId()
  planId?: string;

  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsDateString()
  currentPeriodEnd?: string;

  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @IsOptional()
  @IsString()
  adminNote?: string;
}
