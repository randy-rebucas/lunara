import { IsMongoId, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateRefundDto {
  @IsMongoId()
  orderId!: string;

  @IsString()
  @MinLength(10)
  reason!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  requestedAmount?: number;
}
