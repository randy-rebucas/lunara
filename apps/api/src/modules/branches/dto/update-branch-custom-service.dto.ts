import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { BookingType } from '@lunara/types';
import { BranchPricingMode } from '@lunara/utils';

export class UpdateBranchCustomServiceDto {
  @IsOptional()
  @IsEnum(BookingType)
  baseBookingType?: BookingType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKg?: number;

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

  @IsOptional()
  @IsNumber()
  @Min(0)
  minWeightKg?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
