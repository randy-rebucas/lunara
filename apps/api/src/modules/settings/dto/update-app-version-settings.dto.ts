import { IsOptional, IsString } from 'class-validator';

export class UpdateAppVersionSettingsDto {
  @IsOptional()
  @IsString()
  customerMinAppVersion?: string;

  @IsOptional()
  @IsString()
  customerLatestAppVersion?: string;

  @IsOptional()
  @IsString()
  customerIosStoreUrl?: string;

  @IsOptional()
  @IsString()
  customerAndroidStoreUrl?: string;

  @IsOptional()
  @IsString()
  riderMinAppVersion?: string;

  @IsOptional()
  @IsString()
  riderLatestAppVersion?: string;

  @IsOptional()
  @IsString()
  riderIosStoreUrl?: string;

  @IsOptional()
  @IsString()
  riderAndroidStoreUrl?: string;
}
