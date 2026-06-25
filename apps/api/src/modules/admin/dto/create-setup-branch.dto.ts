import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateSetupBranchDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(['franchise', 'partner_shop'])
  branchType!: 'franchise' | 'partner_shop';

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
  @Min(1)
  maxActiveOrders?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxWeightCapacityKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  serviceRadiusKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;
}
