import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class BranchMachineDto {
  @IsString()
  id!: string;

  @IsString()
  label!: string;

  @IsEnum(['washer', 'dryer', 'folder', 'press', 'other'])
  machineType!: string;

  @IsEnum(['active', 'maintenance', 'offline'])
  status!: string;

  @IsNumber()
  @Min(1)
  capacityKg!: number;
}

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['hq', 'franchise', 'partner_shop'])
  branchType?: 'hq' | 'franchise' | 'partner_shop';

  @IsOptional()
  @IsMongoId()
  parentBranchId?: string;

  @IsOptional()
  @IsMongoId()
  managerUserId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  line1?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  city?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  province?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates?: [number, number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxActiveOrders?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxWeightCapacityKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyQuotaOrders?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyQuotaWeightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  serviceRadiusKm?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchMachineDto)
  machines?: BranchMachineDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  kgPerLoad?: number;
}
