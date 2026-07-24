import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { CreateBookingOrderDto } from '../../booking/dto/booking.dto';

const FREQUENCY_DAYS = [7, 14, 30] as const;

export class CreateSubscriptionDto extends CreateBookingOrderDto {
  @IsIn(FREQUENCY_DAYS)
  frequencyDays!: (typeof FREQUENCY_DAYS)[number];
}

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
