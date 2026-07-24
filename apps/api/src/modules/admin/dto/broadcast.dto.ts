import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@lunara/types';

const AUDIENCE_VALUES = ['all', ...Object.values(UserRole)] as const;

export class BroadcastDto {
  @IsString()
  @MinLength(1)
  @MaxLength(65)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  body!: string;

  @IsOptional()
  @IsIn(AUDIENCE_VALUES)
  audience?: 'all' | UserRole;
}
