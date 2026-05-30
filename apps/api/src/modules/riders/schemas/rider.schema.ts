import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RiderDocument = HydratedDocument<Rider>;

@Schema({ _id: false })
class RiderEarningRecord {
  @Prop({ required: true, enum: ['pickup', 'delivery'] })
  type!: 'pickup' | 'delivery';

  @Prop({ required: true })
  amount!: number;

  @Prop({ type: Types.ObjectId, required: true })
  orderId!: Types.ObjectId;

  @Prop({ default: Date.now })
  earnedAt!: Date;
}

@Schema({ timestamps: true, collection: 'riders' })
export class Rider {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ default: 'motorcycle' })
  vehicleType!: string;

  @Prop({ default: false })
  isOnline!: boolean;

  @Prop({ type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: [0, 0] } })
  currentLocation!: { type: string; coordinates: number[] };

  @Prop({ default: 0 })
  totalEarnings!: number;

  @Prop({ default: 0 })
  todayEarnings!: number;

  @Prop()
  earningsDayKey?: string;

  @Prop({ type: [RiderEarningRecord], default: [] })
  recentEarnings!: RiderEarningRecord[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const RiderSchema = SchemaFactory.createForClass(Rider);
RiderSchema.index({ currentLocation: '2dsphere' });
