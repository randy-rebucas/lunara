import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingType } from '@lunara/types';

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
}
