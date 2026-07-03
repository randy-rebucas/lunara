import { Type } from 'class-transformer';
import { ValidateNested, IsArray, IsEnum, IsNumber, Min } from 'class-validator';
import { BookingType } from '@lunara/types';

export class BranchServicePriceDto {
  @IsEnum(BookingType)
  serviceType!: BookingType;

  @IsNumber()
  @Min(0)
  basePricePerKg!: number;
}

export class UpdateBranchPricingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchServicePriceDto)
  servicePricing!: BranchServicePriceDto[];
}
