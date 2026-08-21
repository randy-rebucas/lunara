import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpdateLocationDto {
  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  speed?: number;

  @IsOptional()
  @IsNumber()
  heading?: number;

  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class UpdateRiderHomeAddressDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  province?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}

export class UpdateRiderProfileDto {
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
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  phone?: string;

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
}

export class UpdateRiderEmploymentDto {
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

export class ReviewRiderDocumentDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
