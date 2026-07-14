import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

const TIME_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class DayOperatingHoursDto {
  @IsBoolean()
  isClosed!: boolean;

  @IsString()
  @Matches(TIME_HH_MM, { message: 'openTime must be in 24h "HH:mm" format' })
  openTime!: string;

  @IsString()
  @Matches(TIME_HH_MM, { message: 'closeTime must be in 24h "HH:mm" format' })
  closeTime!: string;
}

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

  /** Weekly schedule, length 7, index = JS `Date.getDay()` (0 = Sunday … 6 = Saturday). */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => DayOperatingHoursDto)
  operatingHours?: DayOperatingHoursDto[];
}
