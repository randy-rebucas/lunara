import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { BookingType } from '@lunara/types';

export class CreateBranchCustomAddonDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, numbers, and hyphens only' })
  slug!: string;

  @IsString()
  label!: string;

  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  /** Booking types this add-on may be attached to (empty/omitted = applies to any service). */
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
