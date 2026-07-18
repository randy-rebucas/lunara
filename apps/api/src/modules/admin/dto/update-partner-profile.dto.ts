import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

const PLANS = ['trial', 'basic', 'starter', 'professional'] as const;

export class UpdatePartnerProfileDto {
  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsIn(PLANS)
  subscriptionPlan?: (typeof PLANS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  planPrice?: number;

  @IsOptional()
  @IsDateString()
  planRenewsAt?: string;

  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  tin?: string;

  @IsOptional()
  @IsString()
  businessPermitNumber?: string;

  @IsOptional()
  @IsBoolean()
  businessPermitVerified?: boolean;

  @IsOptional()
  @IsString()
  birRegistrationNumber?: string;

  @IsOptional()
  @IsBoolean()
  birRegistrationVerified?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryRadiusKm?: number;
}
