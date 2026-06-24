import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePartnerDto {
  @IsString()
  ownerEmail!: string;

  @IsString()
  @MinLength(2)
  legalName!: string;

  @IsString()
  @MinLength(2)
  slug!: string;
}

class PartnerBrandColorsDto {
  @IsOptional()
  @IsString()
  primary?: string;

  @IsOptional()
  @IsString()
  secondary?: string;

  @IsOptional()
  @IsString()
  accent?: string;

  @IsOptional()
  @IsString()
  background?: string;

  @IsOptional()
  @IsString()
  foreground?: string;

  @IsOptional()
  @IsString()
  muted?: string;

  @IsOptional()
  @IsString()
  border?: string;

  @IsOptional()
  @IsString()
  destructive?: string;
}

class PartnerBrandFontsDto {
  @IsOptional()
  @IsString()
  sans?: string;

  @IsOptional()
  @IsString()
  heading?: string;
}

export class UpdatePartnerBrandConfigDto {
  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  appDisplayName?: string;

  @IsOptional()
  colors?: PartnerBrandColorsDto;

  @IsOptional()
  fonts?: PartnerBrandFontsDto;

  @IsOptional()
  @IsString()
  status?: 'draft' | 'pending_review' | 'live';
}

export class SetPartnerActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
