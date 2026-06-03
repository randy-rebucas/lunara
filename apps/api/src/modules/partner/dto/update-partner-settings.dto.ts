import { IsBoolean, IsOptional } from 'class-validator';

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
}
