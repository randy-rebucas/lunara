import { IsEmail, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PartnerLeadColorsDto {
  @IsString()
  primary!: string;

  @IsString()
  secondary!: string;

  @IsString()
  accent!: string;

  @IsString()
  background!: string;

  @IsString()
  foreground!: string;

  @IsString()
  muted!: string;

  @IsString()
  border!: string;

  @IsString()
  destructive!: string;
}

class PartnerLeadManifestDto {
  @IsString()
  appName!: string;

  @IsString()
  slug!: string;

  @IsString()
  iosBundleId!: string;

  @IsString()
  androidPackage!: string;

  @IsOptional()
  @IsString()
  easProjectId?: string;

  @IsString()
  splashBackgroundColor!: string;
}

export class CreatePartnerLeadDto {
  @IsString()
  @MinLength(2)
  brandName!: string;

  @IsString()
  @MinLength(2)
  contactName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsString()
  logoUrl!: string;

  @ValidateNested()
  @Type(() => PartnerLeadColorsDto)
  colors!: PartnerLeadColorsDto;

  @ValidateNested()
  @Type(() => PartnerLeadManifestDto)
  manifest!: PartnerLeadManifestDto;
}

export class UpdatePartnerLeadStatusDto {
  @IsIn(['new', 'contacted', 'archived'])
  status!: 'new' | 'contacted' | 'archived';
}
