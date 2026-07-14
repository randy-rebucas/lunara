import { OrderStatus } from '@lunara/types';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class AssignRiderDto {
  @IsOptional()
  @IsString()
  riderId?: string;

  @IsOptional()
  @IsString()
  type?: 'pickup' | 'delivery';
}
