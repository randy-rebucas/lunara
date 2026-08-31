import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PartnerExpenseDocument = HydratedDocument<PartnerExpense>;

@Schema({ timestamps: true, collection: 'partner_expenses' })
export class PartnerExpense {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  partnerUserId!: Types.ObjectId;

  @Prop({ required: true, default: 'other' })
  category!: string;

  @Prop({ required: true, min: 0 })
  amount!: number;

  /** When the expense was incurred — distinct from createdAt (when the record was entered). */
  @Prop({ required: true })
  date!: Date;

  @Prop()
  note?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PartnerExpenseSchema = SchemaFactory.createForClass(PartnerExpense);
PartnerExpenseSchema.index({ partnerUserId: 1, date: -1 });
