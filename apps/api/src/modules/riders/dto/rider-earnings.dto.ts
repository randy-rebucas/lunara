import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { RiderEarningType } from '@lunara/utils';

export class CreditRiderEarningDto {
  @IsEnum(['bonus', 'adjustment', 'wage'])
  type!: Extract<RiderEarningType, 'bonus' | 'adjustment' | 'wage'>;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
