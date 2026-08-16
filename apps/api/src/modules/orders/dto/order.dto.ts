import { OrderStatus } from '@lunara/types';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class RescheduleOrderDto {
  @IsDateString()
  scheduledPickupAt!: string;
}

export class CancelOrderDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class AssignRiderDto {
  @IsOptional()
  @IsString()
  riderId?: string;

  @IsOptional()
  @IsString()
  type?: 'pickup' | 'delivery';
}
