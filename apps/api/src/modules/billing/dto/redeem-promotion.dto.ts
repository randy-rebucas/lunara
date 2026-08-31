import { IsString, MinLength } from 'class-validator';

export class RedeemPromotionDto {
  @IsString()
  @MinLength(2)
  code!: string;
}
