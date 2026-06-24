import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlatformSettingsDocument = HydratedDocument<PlatformSettings>;

/** Singleton document — exactly one row, created on first read with defaults. */
@Schema({ timestamps: true, collection: 'platform_settings' })
export class PlatformSettings {
  /** Delivery fee for Metro Manila / NCR addresses. */
  @Prop({ required: true, default: 50 })
  cityDeliveryFee!: number;

  /** Delivery fee for provincial addresses outside Metro Manila. */
  @Prop({ required: true, default: 80 })
  provinceDeliveryFee!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PlatformSettingsSchema = SchemaFactory.createForClass(PlatformSettings);
