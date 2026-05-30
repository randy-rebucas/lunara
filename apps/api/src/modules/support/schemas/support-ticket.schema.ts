import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SupportTicketDocument = HydratedDocument<SupportTicket>;

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum TicketType {
  GENERAL = 'general',
  LOST_ITEM = 'lost_item',
}

export enum TicketOutcome {
  PENDING = 'pending',
  FOUND = 'found',
  COMPENSATED = 'compensated',
  NO_ACTION = 'no_action',
  DENIED = 'denied',
}

export enum LostItemStage {
  COMPLAINT = 'complaint',
  INVESTIGATION = 'investigation',
  PHOTOS_REVIEWED = 'photos_reviewed',
  LOGS_REVIEWED = 'logs_reviewed',
  OUTCOME = 'outcome',
  COMPENSATION = 'compensation',
  CLOSED = 'closed',
}

@Schema({ _id: false })
class TicketTimelineEntry {
  @Prop({ required: true })
  stage!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ default: Date.now })
  at!: Date;

  @Prop()
  note?: string;
}

@Schema({ timestamps: true, collection: 'support_tickets' })
export class SupportTicket {
  @Prop({ required: true })
  subject!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true, enum: TicketStatus, default: TicketStatus.OPEN })
  status!: TicketStatus;

  @Prop({ required: true, enum: TicketPriority, default: TicketPriority.MEDIUM })
  priority!: TicketPriority;

  @Prop({ required: true, enum: TicketType, default: TicketType.GENERAL })
  type!: TicketType;

  @Prop()
  customerEmail?: string;

  @Prop({ type: Types.ObjectId })
  customerId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  orderId?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  missingItems!: string[];

  @Prop({ enum: LostItemStage })
  investigationStage?: LostItemStage;

  @Prop()
  photosReviewedAt?: Date;

  @Prop()
  logsReviewedAt?: Date;

  @Prop({ enum: TicketOutcome, default: TicketOutcome.PENDING })
  outcome!: TicketOutcome;

  @Prop()
  outcomeNotes?: string;

  @Prop({ default: 0 })
  compensationAmount!: number;

  @Prop()
  compensationCreditedAt?: Date;

  @Prop()
  adminNote?: string;

  @Prop({ type: [TicketTimelineEntry], default: [] })
  timeline!: TicketTimelineEntry[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);
