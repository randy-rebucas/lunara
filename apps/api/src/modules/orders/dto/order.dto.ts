import { BookingType, OrderStatus } from '@lunara/types';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class OrderItemDto {
  @IsEnum(BookingType)
  serviceType!: BookingType;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderDto {
  @IsEnum(BookingType)
  bookingType!: BookingType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsString()
  pickupAddressId!: string;

  @IsString()
  deliveryAddressId!: string;

  @IsDateString()
  scheduledPickupAt!: string;

  @IsOptional()
  @IsDateString()
  scheduledDeliveryAt?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}

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
