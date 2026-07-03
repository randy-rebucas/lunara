import { Type } from 'class-transformer';
import { ValidateNested, IsArray, IsString, IsNumber, Min } from 'class-validator';

export class BranchAddonPriceDto {
  @IsString()
  addonSlug!: string;

  @IsNumber()
  @Min(0)
  basePrice!: number;
}

export class UpdateBranchAddonPricingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchAddonPriceDto)
  addonPricing!: BranchAddonPriceDto[];
}
