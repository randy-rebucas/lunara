import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(['franchise', 'partner_shop'])
  branchType!: 'franchise' | 'partner_shop';

  @IsMongoId()
  parentBranchId!: string;

  @IsString()
  @IsNotEmpty()
  line1!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  province!: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsMongoId()
  partnerUserId!: string;

  @IsOptional()
  @IsMongoId()
  managerUserId?: string;

  @IsArray()
  @IsNumber({}, { each: true })
  coordinates!: [number, number];

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxActiveOrders?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxWeightCapacityKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  dailyQuotaOrders?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  dailyQuotaWeightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  serviceRadiusKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  kgPerLoad?: number;
}
