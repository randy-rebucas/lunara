import { IsNumber, IsOptional, IsString, Min, MinLength, MaxLength } from 'class-validator';

export class CreateInventoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  sku!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  category!: string;

  /** Only meaningful for a PARTNER managing more than one branch; ignored otherwise (falls back to their one branch). */
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  usagePerOrder?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  usagePerKg?: number;
}
