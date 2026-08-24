import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ShopInventoryDocument = HydratedDocument<ShopInventoryItem>;

@Schema({ timestamps: true, collection: 'shop_inventory' })
export class ShopInventoryItem {
  /**
   * Owning branch. Absent on rows created before per-branch scoping shipped — those are
   * orphaned (no longer returned by any query, which all filter on branchId) rather than
   * migrated, since there was no reliable way to attribute pre-existing shared rows to one
   * specific branch.
   */
  @Prop({ type: Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
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

  /** Units auto-deducted from stock once per completed order (e.g. 1 bag, 1 tag). 0 = not auto-tracked. */
  @Prop({ required: true, default: 0 })
  usagePerOrder!: number;

  /** Units auto-deducted from stock per kg of verified laundry weight on a completed order
   * (e.g. detergent/softener dosage). 0 = not auto-tracked. */
  @Prop({ required: true, default: 0 })
  usagePerKg!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ShopInventorySchema = SchemaFactory.createForClass(ShopInventoryItem);
// Replaces the old bare-`sku` unique index — each branch keeps its own SKU namespace now.
// Mongoose's default autoIndex creates this on startup but does not drop the old single-field
// unique index on `sku`; that stale index must be dropped manually in any already-deployed
// database (`db.shop_inventory.dropIndex('sku_1')`) before two branches can share a SKU code.
ShopInventorySchema.index({ branchId: 1, sku: 1 }, { unique: true });
