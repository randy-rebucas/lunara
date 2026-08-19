import { Type } from 'class-transformer';
import { ValidateNested, IsArray, IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { BranchPricingMode } from '@lunara/utils';
import { BookingType } from '@lunara/types';

export class BranchAddonPriceDto {
  @IsString()
  addonSlug!: string;

  @IsNumber()
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basePricePerKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basePricePerLoad?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basePricePerPiece?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basePricePerPair?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basePricePerItem?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedPrice?: number;

  @IsOptional()
  @IsEnum(BranchPricingMode)
  pricingUnit?: BranchPricingMode;

  /** Booking types this add-on may be attached to (empty/omitted = applies to any service). */
  @IsOptional()
  @IsArray()
  @IsEnum(BookingType, { each: true })
  applicableServiceTypes?: BookingType[];
}

export class UpdateBranchAddonPricingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchAddonPriceDto)
  addonPricing!: BranchAddonPriceDto[];
}
