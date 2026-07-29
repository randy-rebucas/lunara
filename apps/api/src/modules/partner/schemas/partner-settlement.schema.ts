import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PartnerSettlementDocument = HydratedDocument<PartnerSettlement>;

@Schema({ timestamps: true, collection: 'partner_settlements' })
export class PartnerSettlement {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  partnerId!: Types.ObjectId;

  @Prop({ required: true })
  periodStart!: Date;

  @Prop({ required: true })
  periodEnd!: Date;

  @Prop({ required: true, default: 0 })
  totalOrders!: number;

  @Prop({ required: true, default: 0 })
  cashOrders!: number;

  @Prop({ required: true, default: 0 })
  digitalOrders!: number;

  /** Gross revenue: sum of order.total for the period */
  @Prop({ required: true, default: 0 })
  totalAmount!: number;

  /** Lunara's platform fee: sum of (order.subtotal × commissionRate) */
  @Prop({ required: true, default: 0 })
  lunaraFee!: number;

  /** What the partner actually receives: totalAmount − lunaraFee */
  @Prop({ required: true, default: 0 })
  partnerPayout!: number;

  /** Commission rate applied at time of settlement (snapshot) */
  @Prop({ required: true, default: 0.20 })
  commissionRate!: number;

  @Prop({ required: true, enum: ['pending', 'paid'], default: 'pending' })
  status!: 'pending' | 'paid';

  @Prop()
  paidAt?: Date;

  @Prop({ type: Types.ObjectId })
  paidBy?: Types.ObjectId;

  @Prop()
  adminNote?: string;

  /**
   * Running total of refunds issued (post-settlement) against orders that were part of this
   * settlement — i.e. money the partner was already paid for but the customer got back. Doesn't
   * move any cash on its own; surfaced so admins can deduct it from the partner's next payout.
   */
  @Prop({ default: 0 })
  clawbackTotal!: number;

  @Prop({ default: 0 })
  clawbackOrderCount!: number;

  /** How much of this settlement's own clawbackTotal has since been recovered — deducted from a
   * later settlement's payout for the same partner. clawbackTotal − clawbackRecovered is what's
   * still outstanding. See PartnerOperationsService.getOutstandingClawbackBalance(). */
  @Prop({ default: 0 })
  clawbackRecovered!: number;

  /** Amount deducted from THIS settlement's own payout to recover outstanding clawback balance
   * from the partner's earlier settlements (opt-in, via CreateSettlementDto.recoverClawback). */
  @Prop({ default: 0 })
  clawbackRecoveryApplied!: number;

  /** Actual rider pickup+delivery task cost for the orders in this settlement (looked up from the
   * ledger, not estimated) — deducted from partnerPayout so the partner, who already received the
   * full customer-paid deliveryFee inside totalAmount, funds the delivery instead of Lunara. */
  @Prop({ default: 0 })
  riderCostRecovered!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PartnerSettlementSchema = SchemaFactory.createForClass(PartnerSettlement);
