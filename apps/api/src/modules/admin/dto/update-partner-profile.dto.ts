import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePartnerProfileDto {
  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  tin?: string;

  @IsOptional()
  @IsString()
  businessPermitNumber?: string;

  @IsOptional()
  @IsBoolean()
  businessPermitVerified?: boolean;

  @IsOptional()
  @IsString()
  birRegistrationNumber?: string;

  @IsOptional()
  @IsBoolean()
  birRegistrationVerified?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryRadiusKm?: number;
}
