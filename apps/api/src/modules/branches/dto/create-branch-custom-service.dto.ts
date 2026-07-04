import { IsEnum, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { BookingType } from '@lunara/types';

export class CreateBranchCustomServiceDto {
  @IsEnum(BookingType)
  baseBookingType!: BookingType;

  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  pricePerKg!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minWeightKg?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
