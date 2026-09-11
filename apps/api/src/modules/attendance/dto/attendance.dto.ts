import { IsDateString, IsIn, IsLatitude, IsLongitude, IsMongoId, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

class ClockLocationDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

export class ClockInDto {
  @IsOptional()
  @Type(() => ClockLocationDto)
  location?: ClockLocationDto;
}

export class ClockOutDto {
  @IsOptional()
  @Type(() => ClockLocationDto)
  location?: ClockLocationDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class QueryAttendanceDto {
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @IsIn(['staff', 'rider'])
  role?: 'staff' | 'rider';

  /** YYYY-MM-DD, inclusive */
  @IsOptional()
  @IsString()
  from?: string;

  /** YYYY-MM-DD, inclusive */
  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsIn(['active', 'completed'])
  status?: 'active' | 'completed';

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class CorrectAttendanceDto {
  @IsOptional()
  @IsDateString()
  clockInAt?: string;

  /** Present + a valid date string to set/change clock-out; explicit `null` reopens the session
   * (clears clock-out); omitted leaves the existing value untouched. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  clockOutAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
