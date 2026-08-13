import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PartnerTerritoryDocument = HydratedDocument<PartnerTerritory>;

@Schema({ timestamps: true, collection: 'partner_territories' })
export class PartnerTerritory {
  /** 1:1 with Partner._id — a territory is a facet of exactly one partner, not a grouping of many. */
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  partnerId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true })
  slug!: string;

  /** 'radius' mirrors Branch.serviceRadiusKm's simple center+radius model; 'polygon' is a drawn
   * boundary for hard exclusivity enforcement. */
  @Prop({ required: true, enum: ['radius', 'polygon'], default: 'radius' })
  boundaryType!: 'radius' | 'polygon';

  @Prop({
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] },
  })
  center?: { type: string; coordinates: [number, number] };

  @Prop({ min: 0 })
  radiusKm?: number;

  /** GeoJSON Polygon/MultiPolygon, set when boundaryType = 'polygon'. */
  @Prop({ type: MongooseSchema.Types.Mixed })
  boundary?: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };

  /** When true, no other partner's dispatch (auto or admin-manual) may claim bookings whose
   * address falls inside this territory — see branches.service.ts geofence checks. */
  @Prop({ default: true })
  isExclusive!: boolean;

  @Prop({ default: 'active', enum: ['active', 'pending', 'suspended'] })
  status!: 'active' | 'pending' | 'suspended';

  @Prop()
  primaryContactName?: string;

  @Prop()
  primaryContactPhone?: string;

  @Prop()
  opsNotes?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PartnerTerritorySchema = SchemaFactory.createForClass(PartnerTerritory);
PartnerTerritorySchema.index({ center: '2dsphere' });
PartnerTerritorySchema.index({ boundary: '2dsphere' });
