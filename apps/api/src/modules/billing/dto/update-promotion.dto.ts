import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePromotionDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  adminNote?: string;
}
