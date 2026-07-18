import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  PARTNER_APPLICATION_BUSINESS_TYPES,
  PartnerApplicationBusinessType,
} from '../schemas/partner-application.schema';

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

export class PartnerAddressDto {
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

export class PartnerOperationsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100000)
  dailyCapacityKg!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  serviceRadiusKm!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  operatingHours!: string;
}

export class CreatePartnerApplicationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  businessName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  ownerFullName!: string;

  @IsEmail()
  @MaxLength(120)
  email!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(20)
  phone!: string;

  @IsIn(PARTNER_APPLICATION_BUSINESS_TYPES)
  businessType!: PartnerApplicationBusinessType;

  @Transform(parseJsonGroup(PartnerAddressDto))
  @ValidateNested()
  @Type(() => PartnerAddressDto)
  address!: PartnerAddressDto;

  @Transform(parseJsonGroup(PartnerOperationsDto))
  @ValidateNested()
  @Type(() => PartnerOperationsDto)
  operations!: PartnerOperationsDto;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @Equals(true, { message: 'You must accept the declaration to submit your application' })
  declarationAccepted!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
