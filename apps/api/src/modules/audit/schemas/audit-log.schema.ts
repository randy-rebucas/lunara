import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  actorUserId!: Types.ObjectId;

  @Prop({ required: true })
  actorEmail!: string;

  @Prop({ required: true })
  actorRole!: string;

  /** HTTP method of the mutating request, e.g. POST, PATCH, DELETE. */
  @Prop({ required: true })
  method!: string;

  /** Full request path including the /api/v1 prefix, e.g. /api/v1/admin/riders/507f.../approve. */
  @Prop({ required: true, index: true })
  path!: string;

  /** Short label derived from the route for display, e.g. "admin.riders.update". */
  @Prop({ required: true, index: true })
  action!: string;

  @Prop({ required: true })
  statusCode!: number;

  @Prop({ type: Object, default: null })
  requestBody?: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  params?: Record<string, unknown> | null;

  @Prop({ type: String, default: null })
  ip?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
