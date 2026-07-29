import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateSettlementDto {
  @IsArray()
  @IsString({ each: true })
  orderIds!: string[];

  @IsOptional()
  @IsString()
  adminNote?: string;

  /** Opt-in: deduct this partner's outstanding post-settlement clawback balance (unrecovered
   * refunds on orders from earlier settlements) from this new settlement's payout. */
  @IsOptional()
  @IsBoolean()
  recoverClawback?: boolean;
}
