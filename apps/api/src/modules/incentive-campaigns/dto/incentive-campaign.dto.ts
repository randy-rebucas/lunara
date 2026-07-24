import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateIncentiveCampaignDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(1)
  bonusAmount!: number;

  @IsNumber()
  @Min(1)
  thresholdDeliveries!: number;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}

export class UpdateIncentiveCampaignDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
