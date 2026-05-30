import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketPriority, TicketStatus } from '../schemas/support-ticket.schema';

export class UpdateTicketDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  adminNote?: string;
}
