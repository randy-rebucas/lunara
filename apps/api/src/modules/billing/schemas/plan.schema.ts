import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlanDocument = HydratedDocument<Plan>;

/**
 * Admin-manageable subscription tier. Replaces the previous hard-coded
 * 'trial'|'basic'|'starter'|'professional' union that lived directly on User —
 * `key` keeps those same string values for backward compatibility with
 * PartnerSubscriptionInfo (apps/partner-web reads subscription.subscriptionPlan
 * against that union), but new plans are no longer restricted to it.
 */
@Schema({ timestamps: true, collection: 'plans' })
export class Plan {
  @Prop({ required: true, unique: true })
  key!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, default: 0 })
  monthlyPrice!: number;

  @Prop({ default: 0 })
  trialDays!: number;

  /** e.g. { maxBranches: 1, maxStaff: 5, maxOrdersPerMonth: 500 } — read by EntitlementService,
   * keys are a convention shared with callers, not enforced by the schema. */
  @Prop({ type: Object, default: {} })
  limits!: Record<string, number>;

  /** e.g. { customBranding: true, apiAccess: false } */
  @Prop({ type: Object, default: {} })
  features!: Record<string, boolean>;

  /** Reserved for a later phase — always empty in Phase 1. */
  @Prop({ type: [Object], default: [] })
  addOns!: { key: string; name: string; price: number }[];

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
