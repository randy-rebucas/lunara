import { PromotionAudience, PromotionKind } from '@lunara/types';
import { IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreatePromotionDto {
  @IsString()
  @MinLength(3)
  code!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['percent', 'fixed'])
  discountType!: 'percent' | 'fixed';

  @IsNumber()
  @Min(0)
  discountValue!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(PromotionAudience)
  audience?: PromotionAudience;

  @IsOptional()
  @IsEnum(PromotionKind)
  kind?: PromotionKind;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsesPerCustomer?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  newCustomerWithinDays?: number;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;
}
