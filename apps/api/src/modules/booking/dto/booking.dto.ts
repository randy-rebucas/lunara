import { BookingType } from '@lunara/types';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class BookingQuoteDto {
  @IsEnum(BookingType)
  bookingType!: BookingType;

  /** Required for the general customer shop-selection flow; omitted for white-labeled partner bookings. */
  @IsOptional()
  @IsString()
  branchId?: string;

  /** When set, prices/labels this line item from the shop's own custom service instead of the global catalog. */
  @IsOptional()
  @IsString()
  customServiceId?: string;

  @IsNumber()
  @Min(1)
  @Max(50)
  weightKg!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  addonIds?: string[];

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsDateString()
  scheduledPickupAt?: string;
}

export class BookingAvailabilityQueryDto {
  @IsString()
  addressId!: string;
}

export class CreateBookingOrderDto extends BookingQuoteDto {
  @IsString()
  pickupAddressId!: string;

  @IsOptional()
  @IsString()
  deliveryAddressId?: string;

  @IsDateString()
  declare scheduledPickupAt: string;
}
