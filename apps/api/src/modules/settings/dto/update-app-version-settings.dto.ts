import { IsOptional, IsString, Matches } from 'class-validator';

// Matches compareVersions' (packages/utils/src/version.ts) numeric-dotted-segment format —
// anything else silently parses as 0 there, so reject it here instead of at enforcement time.
const VERSION_PATTERN = /^\d+(\.\d+)*$/;
const VERSION_MESSAGE = 'Must be a dotted numeric version, e.g. 1.2.10';

export class UpdateAppVersionSettingsDto {
  @IsOptional()
  @IsString()
  @Matches(VERSION_PATTERN, { message: VERSION_MESSAGE })
  customerMinAppVersion?: string;

  @IsOptional()
  @IsString()
  @Matches(VERSION_PATTERN, { message: VERSION_MESSAGE })
  customerLatestAppVersion?: string;

  @IsOptional()
  @IsString()
  customerIosStoreUrl?: string;

  @IsOptional()
  @IsString()
  customerAndroidStoreUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(VERSION_PATTERN, { message: VERSION_MESSAGE })
  riderMinAppVersion?: string;

  @IsOptional()
  @IsString()
  @Matches(VERSION_PATTERN, { message: VERSION_MESSAGE })
  riderLatestAppVersion?: string;

  @IsOptional()
  @IsString()
  riderIosStoreUrl?: string;

  @IsOptional()
  @IsString()
  riderAndroidStoreUrl?: string;
}
