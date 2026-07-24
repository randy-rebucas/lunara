import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class VerifyShopWeightDto {
  @IsNumber()
  @Min(0.1)
  verifiedWeightKg!: number;

  /** PER_LOAD orders only — actual load count, if different from the weight-derived estimate. */
  @IsOptional()
  @IsInt()
  @Min(1)
  verifiedLoadCount?: number;

  /** PER_PIECE orders only — actual piece count. */
  @IsOptional()
  @IsInt()
  @Min(1)
  verifiedPieceCount?: number;

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
