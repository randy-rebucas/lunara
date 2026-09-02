import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';

class AppConfigThemeDto {
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

class AppConfigBlockDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsInt()
  @Min(0)
  order!: number;

  @IsObject()
  props!: Record<string, unknown>;
}

class AppConfigScreenDto {
  @IsString()
  id!: string;

  @IsString()
  key!: string;

  @IsString()
  title!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppConfigBlockDto)
  blocks!: AppConfigBlockDto[];
}

export class SaveDraftDto {
  @ValidateNested()
  @Type(() => AppConfigThemeDto)
  theme!: AppConfigThemeDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppConfigScreenDto)
  screens!: AppConfigScreenDto[];

  @IsOptional()
  @IsIn(['tabs', 'drawer'])
  navStyle?: 'tabs' | 'drawer';
}

export class ClaimAppConfigDto extends SaveDraftDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  brandName!: string;
}
