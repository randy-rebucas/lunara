import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { UpdateRiderHomeAddressDto } from '../../riders/dto/rider.dto';

/** Partner-facing rider edit — profile fields plus employment/wage, which are now purely the
 * partner's own bookkeeping (no platform wallet meaning once the rider has a partnerId). */
export class UpdateRiderByPartnerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateRiderHomeAddressDto)
  homeAddress?: UpdateRiderHomeAddressDto;

  @IsOptional()
  @IsIn(['motorcycle', 'bicycle', 'car', 'van'])
  vehicleType?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  plateNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  orCrNumber?: string;

  @IsOptional()
  @IsIn(['employee', 'independent_contractor'])
  employmentType?: 'employee' | 'independent_contractor';

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedWageAmount?: number;

  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  wageFrequency?: 'daily' | 'weekly' | 'monthly';
}
