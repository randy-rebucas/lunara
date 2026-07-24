import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FavoriteBranchDocument = HydratedDocument<FavoriteBranch>;

@Schema({ timestamps: true, collection: 'favorite_branches' })
export class FavoriteBranch {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const FavoriteBranchSchema = SchemaFactory.createForClass(FavoriteBranch);

FavoriteBranchSchema.index({ userId: 1, branchId: 1 }, { unique: true });
