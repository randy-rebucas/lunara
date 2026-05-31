import { PushPlatform } from '@lunara/types';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @MinLength(10)
  token!: string;

  @IsEnum(PushPlatform)
  platform!: PushPlatform;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class UnregisterPushTokenDto {
  @IsString()
  @MinLength(10)
  token!: string;
}
