import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateDeliveryFeeDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryBaseDistanceKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryPerKmRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDeliveryRadiusKm?: number;
}
