import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudinaryStorageService } from '../../common/storage/cloudinary-storage.service';
import { partnerApplicationDocumentPublicPath } from '../../common/uploads/upload-paths';
import { CreatePartnerApplicationDto } from './dto/create-partner-application.dto';
import {
  PARTNER_APPLICATION_DOCUMENT_LABELS,
  PARTNER_APPLICATION_DOCUMENT_TYPES,
  PartnerApplicationDocumentType,
} from './partner-application-documents';
import {
  PartnerApplication,
  PartnerApplicationDocument,
  PartnerApplicationStatus,
} from './schemas/partner-application.schema';

const UPLOAD_FOLDER = 'lunara/partner-application-documents';

@Injectable()
export class PartnerApplicationsService {
  constructor(
    @InjectModel(PartnerApplication.name)
    private readonly partnerApplicationModel: Model<PartnerApplicationDocument>,
    private readonly cloudinaryStorageService: CloudinaryStorageService,
  ) {}

  async create(dto: CreatePartnerApplicationDto, files: Record<string, Express.Multer.File[]>) {
    for (const type of PARTNER_APPLICATION_DOCUMENT_TYPES) {
      if (!files?.[type]?.[0]) {
        throw new BadRequestException(`${PARTNER_APPLICATION_DOCUMENT_LABELS[type]} is required`);
      }
    }

    const application = await this.partnerApplicationModel.create({
      businessName: dto.businessName.trim(),
      ownerFullName: dto.ownerFullName.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone.trim(),
      businessType: dto.businessType,
      address: dto.address,
      operations: dto.operations,
      declarationAccepted: dto.declarationAccepted,
      message: dto.message?.trim(),
      status: PartnerApplicationStatus.PENDING,
    });

    const documents: Partial<Record<PartnerApplicationDocumentType, { publicId: string; uploadedAt: Date }>> = {};
    for (const type of PARTNER_APPLICATION_DOCUMENT_TYPES) {
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
      message: 'Application received. Our partnerships team will reach out within a few days.',
    };
  }

  async list(status?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const items = await this.partnerApplicationModel.find(filter).sort({ createdAt: -1 }).limit(200);
    return { success: true, data: items.map((item) => this.serialize(item)) };
  }

  async findOne(id: string) {
    const application = await this.partnerApplicationModel.findById(id);
    if (!application) throw new NotFoundException('Application not found');
    return { success: true, data: this.serialize(application) };
  }

  async updateStatus(id: string, status: PartnerApplicationStatus) {
    const application = await this.partnerApplicationModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
    if (!application) throw new NotFoundException('Application not found');
    return { success: true, data: this.serialize(application) };
  }

  private serialize(application: PartnerApplicationDocument) {
    const documents = Object.fromEntries(
      Object.entries(application.documents ?? {}).map(([type, record]) => [
        type,
        record
          ? { ...record, fileUrl: partnerApplicationDocumentPublicPath(record.publicId) }
          : record,
      ]),
    );

    return {
      _id: application._id.toString(),
      businessName: application.businessName,
      ownerFullName: application.ownerFullName,
      email: application.email,
      phone: application.phone,
      businessType: application.businessType,
      address: application.address,
      operations: application.operations,
      documents,
      declarationAccepted: application.declarationAccepted,
      message: application.message,
      status: application.status,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }
}
