import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateDeliveryFeeDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;
}
