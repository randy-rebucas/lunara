import { Type } from 'class-transformer';
import { ValidateNested, IsArray, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { BookingType } from '@lunara/types';
import { BranchPricingMode } from '@lunara/utils';

export class BranchServicePriceDto {
  @IsEnum(BookingType)
  serviceType!: BookingType;

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
}

export class UpdateBranchPricingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchServicePriceDto)
  servicePricing!: BranchServicePriceDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  kgPerLoad?: number;
}

export class UpdateBranchPricingModeDto {
  @IsEnum(BranchPricingMode)
  pricingMode!: BranchPricingMode;
}
