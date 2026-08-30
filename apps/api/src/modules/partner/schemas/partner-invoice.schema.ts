import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PartnerInvoiceDocument = HydratedDocument<PartnerInvoice>;

@Schema({ timestamps: true, collection: 'partner_invoices' })
export class PartnerInvoice {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  partnerId!: Types.ObjectId;

  /** Human-facing sequential number, e.g. INV-2026-000123. See PartnerOperationsService.nextInvoiceNumber. */
  @Prop({ required: true, unique: true })
  invoiceNumber!: string;

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

  /** Gross revenue the partner collected directly from customers for these orders — informational
   * only, Lunara never touches this cash under the invoicing model. */
  @Prop({ required: true, default: 0 })
  totalCollected!: number;

  /** Lunara's commission on these orders: sum of (order.subtotal x commissionRate), same
   * computeOrderFee logic used before. */
  @Prop({ required: true, default: 0 })
  commissionDue!: number;

  /** Actual rider pickup+delivery task cost for these orders (looked up from the ledger, not
   * estimated) — the partner already collected the full customer-paid deliveryFee directly, so
   * they now reimburse Lunara for fronting the rider cost instead of Lunara deducting it from a
   * payout. */
  @Prop({ required: true, default: 0 })
  riderCostDue!: number;

  /** Flat recurring platform subscription fee charged on this invoice, if the partner's plan
   * renewal was due during this billing cycle. See PartnerOperationsService.createInvoice. */
  @Prop({ required: true, default: 0 })
  subscriptionFeeDue!: number;

  /** commissionDue + riderCostDue + subscriptionFeeDue - creditApplied. What the partner must pay Lunara. */
  @Prop({ required: true, default: 0 })
  amountDue!: number;

  /** Commission rate applied at time of invoicing (snapshot, weighted average across legacy-priced
   * orders — display only, commissionDue above is always computed per-order). */
  @Prop({ required: true, default: 0.20 })
  commissionRate!: number;

  @Prop({ required: true, enum: ['pending', 'paid', 'void'], default: 'pending' })
  status!: 'pending' | 'paid' | 'void';

  @Prop()
  dueDate?: Date;

  @Prop()
  paidAt?: Date;

  @Prop({ type: Types.ObjectId })
  paidBy?: Types.ObjectId;

  /** Admin-entered bank transfer/GCash reference recorded when marking this invoice paid. */
  @Prop()
  paymentReference?: string;

  @Prop()
  adminNote?: string;

  /**
   * Running total of refunds issued (post-invoice) against orders that were part of this
   * invoice — only the commission share of the refund, since Lunara never held the payout share
   * to begin with under this model. Surfaced so a later invoice can credit it back.
   */
  @Prop({ default: 0 })
  creditTotal!: number;

  @Prop({ default: 0 })
  creditOrderCount!: number;

  /** How much of this invoice's own creditTotal has since been applied to reduce a later
   * invoice's amountDue. creditTotal - creditRecovered is what's still outstanding. See
   * PartnerOperationsService.getOutstandingCreditBalance(). */
  @Prop({ default: 0 })
  creditRecovered!: number;

  /** Amount credited off THIS invoice's own amountDue by applying outstanding credit from the
   * partner's earlier invoices (opt-in, via CreateInvoiceDto.applyCredit). */
  @Prop({ default: 0 })
  creditApplied!: number;

  @Prop()
  pdfGeneratedAt?: Date;

  @Prop()
  emailedAt?: Date;

  /** Last email-send failure reason, for admin visibility/retry — cleared on a successful send. */
  @Prop()
  emailError?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PartnerInvoiceSchema = SchemaFactory.createForClass(PartnerInvoice);
