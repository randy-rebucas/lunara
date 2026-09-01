import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocalStorageService } from '../../common/storage/local-storage.service';
import { EmailService } from '../../common/email/email.service';
import { SettingsService } from '../settings/settings.service';
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
  private readonly logger = new Logger(PartnerApplicationsService.name);

  constructor(
    @InjectModel(PartnerApplication.name)
    private readonly partnerApplicationModel: Model<PartnerApplicationDocument>,
    private readonly storageService: LocalStorageService,
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService,
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
      const result = await this.storageService.uploadPrivateBuffer(
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

    void this.notifyAdminNewApplication(application.businessName, application.ownerFullName);

    return {
      success: true,
      data: this.serialize(application),
      message: 'Application received. Our partnerships team will reach out within a few days.',
    };
  }

  private async notifyAdminNewApplication(businessName: string, ownerFullName: string) {
    try {
      const adminEmail = await this.settingsService.getAdminNotificationEmail();
      if (!adminEmail) return;
      await this.emailService.sendAdminNewApplicationNotice(adminEmail, businessName, ownerFullName);
    } catch (err) {
      this.logger.warn(`Admin new-application email skipped: ${(err as Error).message}`);
    }
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

  async updateStatus(id: string, status: PartnerApplicationStatus, rejectionReason?: string) {
    const isRejected = status === PartnerApplicationStatus.REJECTED;
    const application = await this.partnerApplicationModel.findByIdAndUpdate(
      id,
      isRejected
        ? { $set: { status, rejectionReason } }
        : { $set: { status }, $unset: { rejectionReason: '' } },
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
      rejectionReason: application.rejectionReason,
      onboardedPartnerId: application.onboardedPartnerId?.toString(),
      onboardedAt: application.onboardedAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }
}
