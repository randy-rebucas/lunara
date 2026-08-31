import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
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

/** Either "YYYY-MM-DD" (one-off holiday) or "MM-DD" (recurring holiday). */
const DATE_YYYY_MM_DD_OR_MM_DD = /^(\d{4}-)?\d{2}-\d{2}$/;

export class BranchHolidayDto {
  @IsString()
  @Matches(DATE_YYYY_MM_DD_OR_MM_DD, {
    message: 'date must be "YYYY-MM-DD", or "MM-DD" when recurring is true',
  })
  date!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  @IsOptional()
  @IsIn(['closed', 'open'])
  type?: 'closed' | 'open';
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

  /** Partner's own Anthropic API key for the AI Assistant. Pass an empty string to clear it and
   * fall back to the shared platform key. */
  @IsOptional()
  @IsString()
  aiApiKey?: string;

  /** Weekly schedule, length 7, index = JS `Date.getDay()` (0 = Sunday … 6 = Saturday). */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => DayOperatingHoursDto)
  operatingHours?: DayOperatingHoursDto[];

  /** One-off closed dates. Only meaningful set on the partner's main shop — see
   * BranchesService.resolveBranchHolidays for the inheritance rule. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchHolidayDto)
  holidays?: BranchHolidayDto[];
}
