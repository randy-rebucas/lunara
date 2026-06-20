import { IsBoolean } from 'class-validator';

export class SetShopActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
