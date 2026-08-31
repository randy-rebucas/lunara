import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Partner-scoped branch update — omits branchType/parentBranchId/managerUserId/commissionRate,
 * all platform-controlled fields (see BranchesService.updateBranchForPartner). */
export class UpdateOwnBranchDto {
  @IsOptional()
  @IsString()
  name?: string;

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
}
