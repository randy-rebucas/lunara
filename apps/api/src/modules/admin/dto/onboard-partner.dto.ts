import {
  IsArray,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class OnboardPartnerDto {
  // Account
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  // Branch
  @IsString()
  @MinLength(2)
  branchCode!: string;

  @IsString()
  @MinLength(2)
  branchName!: string;

  @IsEnum(['franchise', 'partner_shop'])
  branchType!: 'franchise' | 'partner_shop';

  @IsMongoId()
  parentBranchId!: string;

  @IsString()
  line1!: string;

  @IsString()
  city!: string;

  @IsString()
  province!: string;

  @IsArray()
  @IsNumber({}, { each: true })
  coordinates!: [number, number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxActiveOrders?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxWeightCapacityKg?: number;
}
