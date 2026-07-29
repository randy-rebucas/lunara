import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { PartnerApplicationDocumentType } from '../partner-application-documents';

export type PartnerApplicationDocument = HydratedDocument<PartnerApplication>;

export enum PartnerApplicationStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export const PARTNER_APPLICATION_BUSINESS_TYPES = [
  'sole_proprietorship',
  'partnership',
  'corporation',
] as const;
export type PartnerApplicationBusinessType = (typeof PARTNER_APPLICATION_BUSINESS_TYPES)[number];

@Schema({ _id: false })
class PartnerApplicationAddress {
  @Prop({ required: true, trim: true, maxlength: 160 })
  street!: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  barangay!: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  cityMunicipality!: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  province!: string;

  @Prop({ required: true, trim: true, maxlength: 20 })
  postalCode!: string;
}
const PartnerApplicationAddressSchema = SchemaFactory.createForClass(PartnerApplicationAddress);

@Schema({ _id: false })
class PartnerApplicationOperations {
  @Prop({ required: true })
  dailyCapacityKg!: number;

  @Prop({ required: true })
  serviceRadiusKm!: number;

  @Prop({ required: true, trim: true, maxlength: 160 })
  operatingHours!: string;
}
const PartnerApplicationOperationsSchema = SchemaFactory.createForClass(
  PartnerApplicationOperations,
);

@Schema({ _id: false })
class PartnerApplicationDocumentRecord {
  @Prop({ required: true })
  publicId!: string;

  @Prop({ required: true, default: Date.now })
  uploadedAt!: Date;
}
const PartnerApplicationDocumentRecordSchema = SchemaFactory.createForClass(
  PartnerApplicationDocumentRecord,
);

@Schema({ _id: false })
class PartnerApplicationDocuments {
  @Prop({ type: PartnerApplicationDocumentRecordSchema })
  businessPermit?: PartnerApplicationDocumentRecord;

  @Prop({ type: PartnerApplicationDocumentRecordSchema })
  dtiSecRegistration?: PartnerApplicationDocumentRecord;

  @Prop({ type: PartnerApplicationDocumentRecordSchema })
  birCertificate?: PartnerApplicationDocumentRecord;

  @Prop({ type: PartnerApplicationDocumentRecordSchema })
  ownerValidId?: PartnerApplicationDocumentRecord;

  @Prop({ type: PartnerApplicationDocumentRecordSchema })
  shopPhoto?: PartnerApplicationDocumentRecord;
}
const PartnerApplicationDocumentsSchema = SchemaFactory.createForClass(
  PartnerApplicationDocuments,
);

@Schema({ timestamps: true, collection: 'partner_applications' })
export class PartnerApplication {
  @Prop({ required: true, trim: true, maxlength: 160 })
  businessName!: string;

  @Prop({ required: true, trim: true, maxlength: 160 })
  ownerFullName!: string;

  @Prop({ required: true, trim: true, maxlength: 120, lowercase: true })
  email!: string;

  @Prop({ required: true, trim: true, maxlength: 20 })
  phone!: string;

  @Prop({ required: true, enum: PARTNER_APPLICATION_BUSINESS_TYPES })
  businessType!: PartnerApplicationBusinessType;

  @Prop({ type: PartnerApplicationAddressSchema, required: true })
  address!: PartnerApplicationAddress;

  @Prop({ type: PartnerApplicationOperationsSchema, required: true })
  operations!: PartnerApplicationOperations;

  @Prop({ type: PartnerApplicationDocumentsSchema, default: {} })
  documents!: Partial<Record<PartnerApplicationDocumentType, PartnerApplicationDocumentRecord>>;

  @Prop({ required: true, default: false })
  declarationAccepted!: boolean;

  @Prop({ trim: true, maxlength: 1000 })
  message?: string;

  @Prop({ required: true, enum: PartnerApplicationStatus, default: PartnerApplicationStatus.PENDING })
  status!: PartnerApplicationStatus;

  @Prop({ trim: true, maxlength: 1000 })
  rejectionReason?: string;

  /** Set once an admin actually onboards this applicant (creates their User + Branch) via
   * /admin/partners/onboard with sourceApplicationId — distinct from `status: 'approved'`, which
   * only records the review decision. An application can sit approved for a while before anyone
   * completes onboarding, or in principle be onboarded manually without ever passing through here. */
  @Prop({ type: Types.ObjectId })
  onboardedPartnerId?: Types.ObjectId;

  @Prop()
  onboardedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PartnerApplicationSchema = SchemaFactory.createForClass(PartnerApplication);
