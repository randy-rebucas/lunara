import { BookingType } from '@lunara/types';
import { BAG_SIZES } from '@lunara/utils';
import { IsArray, IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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

  /** Flat platform-wide bag size — see @lunara/utils BAG_SIZES. Required only when the resolved
   * branch is in FLAT_BAG pricing mode. */
  @IsOptional()
  @IsIn(BAG_SIZE_IDS)
  bagSizeId?: string;

  /** Customer-entered weight — required when the resolved branch is in PER_KG pricing mode. */
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  enteredWeightKg?: number;

  /** Customer-entered load count — required when the resolved branch is in PER_LOAD pricing mode. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  enteredLoadCount?: number;

  /** Customer-entered piece count — required when the resolved branch is in PER_PIECE pricing mode. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  enteredPieceCount?: number;

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
