import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TicketOutcome } from '../schemas/support-ticket.schema';

export enum InvestigateAction {
  START = 'start_investigation',
  REVIEW_PHOTOS = 'review_photos',
  REVIEW_LOGS = 'review_logs',
  DETERMINE_OUTCOME = 'determine_outcome',
  COMPENSATE = 'compensate',
  CLOSE = 'close',
}

export class InvestigateTicketDto {
  @IsEnum(InvestigateAction)
  action!: InvestigateAction;

  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @IsEnum(TicketOutcome)
  outcome?: TicketOutcome;

  @IsOptional()
  @IsString()
  outcomeNotes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compensationAmount?: number;
}
