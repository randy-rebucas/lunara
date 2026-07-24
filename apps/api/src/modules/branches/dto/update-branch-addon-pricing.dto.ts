import { Type } from 'class-transformer';
import { ValidateNested, IsArray, IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { BranchPricingMode } from '@lunara/utils';

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
  @IsEnum(BranchPricingMode)
  pricingUnit?: BranchPricingMode;
}

export class UpdateBranchAddonPricingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchAddonPriceDto)
  addonPricing!: BranchAddonPriceDto[];
}
