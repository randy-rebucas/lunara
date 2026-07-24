import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { BookingType } from '@lunara/types';

export class CreateServiceAreaDto {
  @IsString()
  label!: string;

  @IsArray()
  @IsString({ each: true })
  cities!: string[];

  @IsArray()
  @IsString({ each: true })
  provinces!: string[];

  @IsArray()
  @IsString({ each: true })
  postalPrefixes!: string[];

  @IsArray()
  @IsEnum(BookingType, { each: true })
  services!: BookingType[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateServiceAreaDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cities?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  provinces?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  postalPrefixes?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(BookingType, { each: true })
  services?: BookingType[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
