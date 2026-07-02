import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  RIDER_APPLICATION_VEHICLE_TYPES,
  RiderApplicationVehicleType,
} from '../schemas/rider-application.schema';

function parseJsonGroup({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export class AddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  street!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  barangay!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  cityMunicipality!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  province!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  postalCode!: string;
}

export class EmergencyContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  fullName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  relationship!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(20)
  contactNumber!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  address!: string;
}

export class VehicleDto {
  @IsIn(RIDER_APPLICATION_VEHICLE_TYPES)
  type!: RiderApplicationVehicleType;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  make!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  color!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  plateNumber!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  yearModel!: string;
}

export class LicenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  number!: string;

  @IsDateString()
  expirationDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  restrictionCode?: string;
}

export class CreateRiderApplicationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @IsEmail()
  @MaxLength(120)
  email!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(20)
  phone!: string;

  @IsIn(['male', 'female', 'other'])
  gender!: string;

  @IsIn(['single', 'married', 'widowed', 'separated', 'divorced'])
  civilStatus!: string;

  @Transform(parseJsonGroup)
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @Transform(parseJsonGroup)
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergencyContact!: EmergencyContactDto;

  @Transform(parseJsonGroup)
  @ValidateNested()
  @Type(() => VehicleDto)
  vehicle!: VehicleDto;

  @Transform(parseJsonGroup)
  @ValidateNested()
  @Type(() => LicenseDto)
  license!: LicenseDto;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @Equals(true, { message: 'You must accept the declaration to submit your application' })
  declarationAccepted!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
