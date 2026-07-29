import { IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreatePartnerPromotionDto {
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
  @IsNumber()
  @Min(1)
  maxUsesPerCustomer?: number;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;
}
