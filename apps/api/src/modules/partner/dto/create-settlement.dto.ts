import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateSettlementDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  adminNote?: string;
}
