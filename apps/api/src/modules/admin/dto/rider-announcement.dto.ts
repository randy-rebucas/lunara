import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RiderAnnouncementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];
}
