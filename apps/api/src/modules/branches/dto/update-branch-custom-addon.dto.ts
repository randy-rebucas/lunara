import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { BookingType } from '@lunara/types';

export class UpdateBranchCustomAddonDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, numbers, and hyphens only' })
  slug?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsEnum(BookingType, { each: true })
  applicableServiceTypes?: BookingType[];

  @IsOptional()
  @IsBoolean()
  allowsQuantity?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxQuantity?: number;
}
