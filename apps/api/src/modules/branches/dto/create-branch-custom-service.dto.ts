import { IsEnum, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { BookingType } from '@lunara/types';
import { BranchPricingMode } from '@lunara/utils';

export class CreateBranchCustomServiceDto {
  @IsEnum(BookingType)
  baseBookingType!: BookingType;

  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  description!: string;

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
}
