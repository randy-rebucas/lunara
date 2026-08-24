import { BookingType } from '@lunara/types';
import { BAG_SIZES } from '@lunara/utils';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const BAG_SIZE_IDS = BAG_SIZES.map((b) => b.id);

export class GarmentSelectionDto {
  @IsString()
  garmentId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;
}

/** One selected laundry service within a (potentially multi-service) booking — everything needed
 * to price that one service line via calculateQuote. */
export class ServiceSelectionDto {
  @IsEnum(BookingType)
  bookingType!: BookingType;

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

  /** Required (non-empty) when bookingType is garment-priced (see GARMENT_PRICED_BOOKING_TYPES,
   * currently just DRY_CLEANING) — selected garments + quantity to price the order from. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GarmentSelectionDto)
  garmentSelections?: GarmentSelectionDto[];
}

export class BookingQuoteDto {
  /** Every service being booked together (e.g. Wash & Fold + Dry Cleaning + Shoes) — priced and
   * itemized as separate lines, all against one resolved shop/pickup slot. */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ServiceSelectionDto)
  services!: ServiceSelectionDto[];

  /** General customer flow: the shop the customer picked. Omit to let Lunara auto-dispatch to the
   * top-ranked available shop network-wide ("Let Lunara pick a shop for you"). Always omitted for
   * white-labeled partner bookings, which resolve within that partner's own branch pool instead. */
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  addonIds?: string[];

  /** Customer-chosen quantity per add-on id (e.g. { liquid_detergent: 3 }) — only meaningful for
   * add-ons flagged allowsQuantity in the catalog; validated against that catalog in buildQuote. */
  @IsOptional()
  @IsObject()
  addonQuantities?: Record<string, number>;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsDateString()
  scheduledPickupAt?: string;

  /** Free-text note from the customer for the rider/shop — gate code, "leave with guard",
   * detergent preference, etc. Shown alongside pickup/delivery details in the ops-facing apps. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  customerNotes?: string;
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
