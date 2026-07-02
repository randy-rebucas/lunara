import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { RiderApplicationDocumentType } from '../rider-application-documents';

export type RiderApplicationDocument = HydratedDocument<RiderApplication>;

export enum RiderApplicationStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export const RIDER_APPLICATION_VEHICLE_TYPES = ['motorcycle', 'bicycle', 'car', 'van'] as const;
export type RiderApplicationVehicleType = (typeof RIDER_APPLICATION_VEHICLE_TYPES)[number];

@Schema({ _id: false })
class RiderApplicationAddress {
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
const RiderApplicationAddressSchema = SchemaFactory.createForClass(RiderApplicationAddress);

@Schema({ _id: false })
class RiderApplicationEmergencyContact {
  @Prop({ required: true, trim: true, maxlength: 160 })
  fullName!: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  relationship!: string;

  @Prop({ required: true, trim: true, maxlength: 20 })
  contactNumber!: string;

  @Prop({ required: true, trim: true, maxlength: 300 })
  address!: string;
}
const RiderApplicationEmergencyContactSchema = SchemaFactory.createForClass(
  RiderApplicationEmergencyContact,
);

@Schema({ _id: false })
class RiderApplicationVehicle {
  @Prop({ required: true, enum: RIDER_APPLICATION_VEHICLE_TYPES })
  type!: RiderApplicationVehicleType;

  @Prop({ required: true, trim: true, maxlength: 80 })
  make!: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  model!: string;

  @Prop({ required: true, trim: true, maxlength: 40 })
  color!: string;

  @Prop({ required: true, trim: true, maxlength: 20 })
  plateNumber!: string;

  @Prop({ required: true, trim: true, maxlength: 10 })
  yearModel!: string;
}
const RiderApplicationVehicleSchema = SchemaFactory.createForClass(RiderApplicationVehicle);

@Schema({ _id: false })
class RiderApplicationLicense {
  @Prop({ required: true, trim: true, maxlength: 40 })
  number!: string;

  @Prop({ required: true })
  expirationDate!: Date;

  @Prop({ trim: true, maxlength: 20 })
  restrictionCode?: string;
}
const RiderApplicationLicenseSchema = SchemaFactory.createForClass(RiderApplicationLicense);

@Schema({ _id: false })
class RiderApplicationDocumentRecord {
  @Prop({ required: true })
  publicId!: string;

  @Prop({ required: true, default: Date.now })
  uploadedAt!: Date;
}
const RiderApplicationDocumentRecordSchema = SchemaFactory.createForClass(
  RiderApplicationDocumentRecord,
);

@Schema({ _id: false })
class RiderApplicationDocuments {
  @Prop({ type: RiderApplicationDocumentRecordSchema })
  governmentId?: RiderApplicationDocumentRecord;

  @Prop({ type: RiderApplicationDocumentRecordSchema })
  driversLicense?: RiderApplicationDocumentRecord;

  @Prop({ type: RiderApplicationDocumentRecordSchema })
  orReceipt?: RiderApplicationDocumentRecord;

  @Prop({ type: RiderApplicationDocumentRecordSchema })
  crCertificate?: RiderApplicationDocumentRecord;

  @Prop({ type: RiderApplicationDocumentRecordSchema })
  nbiPoliceClearance?: RiderApplicationDocumentRecord;

  @Prop({ type: RiderApplicationDocumentRecordSchema })
  brgyClearance?: RiderApplicationDocumentRecord;

  @Prop({ type: RiderApplicationDocumentRecordSchema })
  selfiePhoto?: RiderApplicationDocumentRecord;

  @Prop({ type: RiderApplicationDocumentRecordSchema })
  vehiclePhoto?: RiderApplicationDocumentRecord;
}
const RiderApplicationDocumentsSchema = SchemaFactory.createForClass(RiderApplicationDocuments);

@Schema({ timestamps: true, collection: 'rider_applications' })
export class RiderApplication {
  @Prop({ required: true, trim: true, maxlength: 80 })
  firstName!: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  lastName!: string;

  @Prop({ required: true, trim: true, maxlength: 120, lowercase: true })
  email!: string;

  @Prop({ required: true, trim: true, maxlength: 20 })
  phone!: string;

  @Prop({ required: true, trim: true, maxlength: 20 })
  gender!: string;

  @Prop({ required: true, trim: true, maxlength: 20 })
  civilStatus!: string;

  @Prop({ type: RiderApplicationAddressSchema, required: true })
  address!: RiderApplicationAddress;

  @Prop({ type: RiderApplicationEmergencyContactSchema, required: true })
  emergencyContact!: RiderApplicationEmergencyContact;

  @Prop({ type: RiderApplicationVehicleSchema, required: true })
  vehicle!: RiderApplicationVehicle;

  @Prop({ type: RiderApplicationLicenseSchema, required: true })
  license!: RiderApplicationLicense;

  @Prop({ type: RiderApplicationDocumentsSchema, default: {} })
  documents!: Partial<Record<RiderApplicationDocumentType, RiderApplicationDocumentRecord>>;

  @Prop({ required: true, default: false })
  declarationAccepted!: boolean;

  @Prop({ trim: true, maxlength: 1000 })
  message?: string;

  @Prop({ required: true, enum: RiderApplicationStatus, default: RiderApplicationStatus.PENDING })
  status!: RiderApplicationStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export const RiderApplicationSchema = SchemaFactory.createForClass(RiderApplication);
