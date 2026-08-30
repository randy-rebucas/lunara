import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ShelfDocument = HydratedDocument<Shelf>;

@Schema({ _id: true, timestamps: true })
export class ShelfItem {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ required: true, default: 1, min: 1 })
  quantity!: number;

  @Prop({ trim: true, maxlength: 300 })
  note?: string;

  @Prop({ type: Types.ObjectId, required: true })
  addedBy!: Types.ObjectId;

  createdAt!: Date;
}

export const ShelfItemSchema = SchemaFactory.createForClass(ShelfItem);

@Schema({ timestamps: true, collection: 'shelves' })
export class Shelf {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 60 })
  name!: string;

  @Prop({ type: [ShelfItemSchema], default: [] })
  items!: ShelfItem[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const ShelfSchema = SchemaFactory.createForClass(Shelf);
ShelfSchema.index({ branchId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
ShelfSchema.index({ branchId: 1, 'items.name': 1 });
