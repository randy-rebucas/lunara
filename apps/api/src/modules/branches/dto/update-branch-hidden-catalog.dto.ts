import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { BookingType } from '@lunara/types';

export class BranchGarmentPriceDto {
  @IsString()
  garmentId!: string;

  @IsNumber()
  @Min(0)
  price!: number;
}

export class UpdateBranchHiddenCatalogDto {
  @IsOptional()
  @IsArray()
  @IsEnum(BookingType, { each: true })
  hiddenServiceTypes?: BookingType[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hiddenAddonSlugs?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hiddenGarmentItemIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchGarmentPriceDto)
  garmentPricing?: BranchGarmentPriceDto[];
}
