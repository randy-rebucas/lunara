import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateSettlementDto {
  @IsArray()
  @IsString({ each: true })
  orderIds!: string[];

  @IsOptional()
  @IsString()
  adminNote?: string;
}
