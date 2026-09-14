import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateRewardsProgramDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  pointsPerCompletedOrder?: number;
}
