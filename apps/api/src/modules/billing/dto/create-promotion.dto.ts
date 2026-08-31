import { ArrayNotEmpty, IsArray, IsDateString, IsIn, IsInt, IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { BillingPromotionDiscountType } from '../schemas/billing-promotion.schema';

export class CreatePromotionDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsIn(['percentage', 'fixed', 'free_months'])
  discountType!: BillingPromotionDiscountType;

  @IsNumber()
  @Min(1)
  discountValue!: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  applicablePlanIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  adminNote?: string;
}
