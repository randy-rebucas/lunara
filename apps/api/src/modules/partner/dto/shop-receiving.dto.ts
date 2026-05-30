import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class VerifyShopWeightDto {
  @IsNumber()
  @Min(0.1)
  verifiedWeightKg!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ConfirmShopItemsDto {
  @IsInt()
  @Min(1)
  itemCount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ReceiveLaundryDto {
  @IsOptional()
  @IsString()
  note?: string;
}
