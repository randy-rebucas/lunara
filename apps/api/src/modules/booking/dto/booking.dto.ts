import { BookingType } from '@lunara/types';
import { BAG_SIZES } from '@lunara/utils';
import { IsArray, IsDateString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

const BAG_SIZE_IDS = BAG_SIZES.map((b) => b.id);

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

  /** Flat platform-wide bag size — see @lunara/utils BAG_SIZES. */
  @IsIn(BAG_SIZE_IDS)
  bagSizeId!: string;

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
