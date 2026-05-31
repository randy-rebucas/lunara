import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum SosIncidentStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
}

export type SosIncidentDocument = HydratedDocument<SosIncident>;

@Schema({ _id: false })
class SosLocation {
  @Prop({ required: true })
  lat!: number;

  @Prop({ required: true })
  lng!: number;

  @Prop({ default: Date.now })
  recordedAt!: Date;
}

@Schema({ timestamps: true, collection: 'rider_sos_incidents' })
export class SosIncident {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  riderUserId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  riderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ required: true, enum: SosIncidentStatus, default: SosIncidentStatus.ACTIVE })
  status!: SosIncidentStatus;

  @Prop()
  dispatchNotifiedAt?: Date;

  @Prop()
  locationSharingStartedAt?: Date;

  @Prop()
  locationSharingStoppedAt?: Date;

  @Prop({ type: SosLocation })
  lastLocation?: SosLocation;

  @Prop()
  resolvedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SosIncidentSchema = SchemaFactory.createForClass(SosIncident);
SosIncidentSchema.index({ riderUserId: 1, orderId: 1, status: 1 });
