import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

/** Partner-scoped branch creation — omits code/branchType/parentBranchId/partnerUserId/managerUserId/
 * commissionRate, all of which the server sets (see BranchesService.createBranchForPartner). */
export class CreateOwnBranchDto {
  @IsString()
  @MinLength(2)
  name!: string;

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
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates?: [number, number];

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
}
