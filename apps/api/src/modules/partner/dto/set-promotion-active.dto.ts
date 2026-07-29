import { IsBoolean } from 'class-validator';

export class SetPromotionActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
