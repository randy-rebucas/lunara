import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlatformSettingsDocument = HydratedDocument<PlatformSettings>;

/** Singleton document — exactly one row, created on first read with defaults. */
@Schema({ timestamps: true, collection: 'platform_settings' })
export class PlatformSettings {
  /** Flat pickup + delivery fee charged on every booking, regardless of address. */
  @Prop({ required: true, default: 70 })
  deliveryFee!: number;

  /** @deprecated superseded by deliveryFee; kept for backward-compat reads only. */
  @Prop({ required: true, default: 50 })
  cityDeliveryFee!: number;

  /** @deprecated superseded by deliveryFee; kept for backward-compat reads only. */
  @Prop({ required: true, default: 80 })
  provinceDeliveryFee!: number;

  /** Auto-assign paid orders to the top-ranked branch instead of waiting for admin dispatch. */
  @Prop({ default: false })
  autoDispatchOrders!: boolean;

  /** Auto-confirm the system-suggested rider for pickup instead of waiting for admin confirmation. */
  @Prop({ default: false })
  autoAssignPickupRider!: boolean;

  /** Auto-confirm the system-suggested rider for delivery instead of waiting for admin confirmation. */
  @Prop({ default: false })
  autoAssignDeliveryRider!: boolean;

  /** Auto-generate partner settlements on a schedule instead of requiring a manual admin trigger. */
  @Prop({ default: false })
  autoGenerateSettlements!: boolean;

  /** Auto-approve/reject refund requests under autoApproveRefundsThreshold with clean evidence. */
  @Prop({ default: false })
  autoApproveRefunds!: boolean;

  /** Peso ceiling under which a refund request may be auto-approved. */
  @Prop({ default: 500 })
  autoApproveRefundsThreshold!: number;

  /** Auto-approve rider withdrawal requests under autoApproveWithdrawalsThreshold. */
  @Prop({ default: false })
  autoApproveWithdrawals!: boolean;

  /** Peso ceiling under which a rider withdrawal may be auto-approved. */
  @Prop({ default: 1000 })
  autoApproveWithdrawalsThreshold!: number;

  /** Flat fee paid to the rider who completes the pickup leg. */
  @Prop({ required: true, default: 35 })
  riderPickupFee!: number;

  /** Flat fee paid to the rider who completes the delivery leg. */
  @Prop({ required: true, default: 35 })
  riderDeliveryFee!: number;

  /** Lowest customer-mobile version allowed to run. '0.0.0' disables force-update enforcement. */
  @Prop({ required: true, default: '0.0.0' })
  customerMinAppVersion!: string;

  /** Version shown to customers as "latest" in the update prompt copy. */
  @Prop({ default: '' })
  customerLatestAppVersion!: string;

  @Prop({ default: '' })
  customerIosStoreUrl!: string;

  @Prop({ default: '' })
  customerAndroidStoreUrl!: string;

  /** Lowest rider-mobile version allowed to run. '0.0.0' disables force-update enforcement. */
  @Prop({ required: true, default: '0.0.0' })
  riderMinAppVersion!: string;

  /** Version shown to riders as "latest" in the update prompt copy. */
  @Prop({ default: '' })
  riderLatestAppVersion!: string;

  @Prop({ default: '' })
  riderIosStoreUrl!: string;

  @Prop({ default: '' })
  riderAndroidStoreUrl!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PlatformSettingsSchema = SchemaFactory.createForClass(PlatformSettings);
