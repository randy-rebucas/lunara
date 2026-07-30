import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ErrorLogDocument = HydratedDocument<ErrorLog>;

@Schema({ timestamps: true, collection: 'error_logs' })
export class ErrorLog {
  /** Where the error was caught — the API itself, or which frontend app reported it. */
  @Prop({ required: true, index: true })
  source!: 'api' | 'admin-web' | 'customer-web' | 'partner-web';

  @Prop({ required: true })
  message!: string;

  @Prop()
  stack?: string;

  /** Request path for API errors, or the browser URL for frontend errors. */
  @Prop({ index: true })
  path?: string;

  @Prop()
  method?: string;

  @Prop({ index: true })
  statusCode?: number;

  @Prop()
  userId?: string;

  @Prop()
  userRole?: string;

  @Prop({ type: Object, default: null })
  context?: Record<string, unknown> | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ErrorLogSchema = SchemaFactory.createForClass(ErrorLog);
ErrorLogSchema.index({ createdAt: -1 });
