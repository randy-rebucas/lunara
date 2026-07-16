import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudinaryStorageService } from '../../common/storage/cloudinary-storage.service';
import { riderApplicationDocumentPublicPath } from '../../common/uploads/upload-paths';
import { CreateRiderApplicationDto } from './dto/create-rider-application.dto';
import {
  RIDER_APPLICATION_DOCUMENT_LABELS,
  RIDER_APPLICATION_DOCUMENT_TYPES,
  RiderApplicationDocumentType,
} from './rider-application-documents';
import {
  RiderApplication,
  RiderApplicationDocument,
  RiderApplicationStatus,
} from './schemas/rider-application.schema';

const UPLOAD_FOLDER = 'lunara/rider-application-documents';

@Injectable()
export class RiderApplicationsService {
  constructor(
    @InjectModel(RiderApplication.name)
    private readonly riderApplicationModel: Model<RiderApplicationDocument>,
    private readonly cloudinaryStorageService: CloudinaryStorageService,
  ) {}

  async create(dto: CreateRiderApplicationDto, files: Record<string, Express.Multer.File[]>) {
    for (const type of RIDER_APPLICATION_DOCUMENT_TYPES) {
      if (!files?.[type]?.[0]) {
        throw new BadRequestException(
          `${RIDER_APPLICATION_DOCUMENT_LABELS[type]} is required`,
        );
      }
    }

    const application = await this.riderApplicationModel.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone.trim(),
      gender: dto.gender,
      civilStatus: dto.civilStatus,
      address: dto.address,
      emergencyContact: dto.emergencyContact,
      vehicle: dto.vehicle,
      license: dto.license,
      declarationAccepted: dto.declarationAccepted,
      message: dto.message?.trim(),
      status: RiderApplicationStatus.PENDING,
    });

    const documents: Partial<Record<RiderApplicationDocumentType, { publicId: string; uploadedAt: Date }>> = {};
    for (const type of RIDER_APPLICATION_DOCUMENT_TYPES) {
      const file = files[type][0];
      const publicId = `${application._id.toString()}-${type}-${Date.now()}`;
      const result = await this.cloudinaryStorageService.uploadPrivateBuffer(
        file.buffer,
        UPLOAD_FOLDER,
        publicId,
        'image',
        file.mimetype,
      );
      documents[type] = { publicId: result.public_id, uploadedAt: new Date() };
    }

    application.documents = documents;
    await application.save();

    return {
      success: true,
      data: this.serialize(application),
      message: 'Application received. Our operations team will reach out within a few days.',
    };
  }

  async list(status?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const items = await this.riderApplicationModel.find(filter).sort({ createdAt: -1 }).limit(200);
    return { success: true, data: items.map((item) => this.serialize(item)) };
  }

  async findOne(id: string) {
    const application = await this.riderApplicationModel.findById(id);
    if (!application) throw new NotFoundException('Application not found');
    return { success: true, data: this.serialize(application) };
  }

  async updateStatus(id: string, status: RiderApplicationStatus) {
    const application = await this.riderApplicationModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
    if (!application) throw new NotFoundException('Application not found');
    return { success: true, data: this.serialize(application) };
  }

  private serialize(application: RiderApplicationDocument) {
    const documents = Object.fromEntries(
      Object.entries(application.documents ?? {}).map(([type, record]) => [
        type,
        record
          ? { ...record, fileUrl: riderApplicationDocumentPublicPath(record.publicId) }
          : record,
      ]),
    );

    return {
      _id: application._id.toString(),
      firstName: application.firstName,
      lastName: application.lastName,
      email: application.email,
      phone: application.phone,
      gender: application.gender,
      civilStatus: application.civilStatus,
      address: application.address,
      emergencyContact: application.emergencyContact,
      vehicle: application.vehicle,
      license: application.license,
      documents,
      declarationAccepted: application.declarationAccepted,
      message: application.message,
      status: application.status,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }
}
