import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { BookingType } from '@lunara/types';

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
  minWeightKg?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
