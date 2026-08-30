import { IsBoolean, IsEmail, IsNumber, IsOptional, IsPhoneNumber, Min } from 'class-validator';

export class UpdateAutomationSettingsDto {
  @IsOptional()
  @IsBoolean()
  autoDispatchOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  autoAssignPickupRider?: boolean;

  @IsOptional()
  @IsBoolean()
  autoAssignDeliveryRider?: boolean;

  @IsOptional()
  @IsBoolean()
  autoGenerateInvoices?: boolean;

  @IsOptional()
  @IsBoolean()
  autoApproveRefunds?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  autoApproveRefundsThreshold?: number;

  @IsOptional()
  @IsBoolean()
  autoApproveWithdrawals?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  autoApproveWithdrawalsThreshold?: number;

  @IsOptional()
  @IsBoolean()
  weeklyStatsEnabled?: boolean;

  @IsOptional()
  @IsPhoneNumber()
  weeklyStatsPhone?: string;

  @IsOptional()
  @IsEmail()
  weeklyStatsEmail?: string;
}
