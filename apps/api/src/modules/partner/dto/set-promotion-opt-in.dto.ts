import { IsBoolean } from 'class-validator';

export class SetPromotionOptInDto {
  @IsBoolean()
  isOptedIn!: boolean;
}
