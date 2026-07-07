import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserProfileDocument = HydratedDocument<UserProfile>;

/** Optional display profile for any user (partner owner or staff) — mirrors the Customer profile pattern. */
@Schema({ timestamps: true, collection: 'user_profiles' })
export class UserProfile {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ trim: true, maxlength: 80 })
  displayName?: string;

  @Prop()
  avatarUrl?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
