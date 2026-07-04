import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateRiderFeesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  riderPickupFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  riderDeliveryFee?: number;
}
