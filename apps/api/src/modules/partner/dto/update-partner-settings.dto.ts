import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePartnerSettingsDto {
  @IsOptional()
  @IsBoolean()
  acceptingOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  autoAcceptIncoming?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyNewOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyPickupArriving?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyLowStock?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyReadyForDelivery?: boolean;

  @IsOptional()
  @IsBoolean()
  allowStaffToRequestDelivery?: boolean;

  @IsOptional()
  @IsBoolean()
  requireWeightVerificationOnReceive?: boolean;

  @IsOptional()
  @IsString()
  payoutMethod?: string;

  @IsOptional()
  @IsString()
  gcashNumber?: string;

  @IsOptional()
  @IsString()
  mayaNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;
}
