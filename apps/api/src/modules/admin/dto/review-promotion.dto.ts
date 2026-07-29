import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewPromotionDto {
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  adminNote?: string;
}
