import { plainToInstance, Transform, Type } from 'class-transformer';
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

/** Multipart fields arrive as JSON strings; convert to the DTO class so nested
 * whitelist validation sees decorated instances (a bare @Transform result would
 * override @Type() conversion and get rejected by forbidNonWhitelisted). */
function parseJsonGroup<T>(cls: new () => T) {
  return ({ value }: { value: unknown }) => {
    let parsed: unknown = value;
    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = {};
      }
    }
    return plainToInstance(cls, parsed);
  };
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

  @Transform(parseJsonGroup(AddressDto))
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @Transform(parseJsonGroup(EmergencyContactDto))
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergencyContact!: EmergencyContactDto;

  @Transform(parseJsonGroup(VehicleDto))
  @ValidateNested()
  @Type(() => VehicleDto)
  vehicle!: VehicleDto;

  @Transform(parseJsonGroup(LicenseDto))
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
