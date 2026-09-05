import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

class SignupAddressDto {
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
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates?: [number, number];
}

export class PartnerSignupDto {
  @IsString()
  @MinLength(2)
  ownerFullName!: string;

  @IsString()
  @MinLength(2)
  businessName!: string;

  @ValidateNested()
  @Type(() => SignupAddressDto)
  address!: SignupAddressDto;

  @IsBoolean()
  wantsBranding!: boolean;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}
