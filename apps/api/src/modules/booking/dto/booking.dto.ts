import { BookingType } from '@lunara/types';
import { BAG_SIZES } from '@lunara/utils';
import { IsArray, IsDateString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

const BAG_SIZE_IDS = BAG_SIZES.map((b) => b.id);

export class BookingQuoteDto {
  @IsEnum(BookingType)
  bookingType!: BookingType;

  /** General customer flow: the shop the customer picked. Omit to let Lunara auto-dispatch to the
   * top-ranked available shop network-wide ("Let Lunara pick a shop for you"). Always omitted for
   * white-labeled partner bookings, which resolve within that partner's own branch pool instead. */
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
