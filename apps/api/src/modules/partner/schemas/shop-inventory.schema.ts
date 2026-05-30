import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ShopInventoryDocument = HydratedDocument<ShopInventoryItem>;

@Schema({ timestamps: true, collection: 'shop_inventory' })
export class ShopInventoryItem {
  @Prop({ required: true, unique: true })
  sku!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, default: 'supplies' })
  category!: string;

  @Prop({ required: true, default: 0 })
  quantity!: number;

  @Prop({ required: true, default: 'units' })
  unit!: string;

  @Prop({ required: true, default: 10 })
  lowStockThreshold!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ShopInventorySchema = SchemaFactory.createForClass(ShopInventoryItem);
