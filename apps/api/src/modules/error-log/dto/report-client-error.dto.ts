import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const SOURCES = ['admin-web', 'customer-web', 'partner-web'] as const;

export class ReportClientErrorDto {
  @IsIn(SOURCES)
  source!: (typeof SOURCES)[number];

  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  path?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  digest?: string;
}
