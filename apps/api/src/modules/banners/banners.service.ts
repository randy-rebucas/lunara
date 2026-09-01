import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocalStorageService } from '../../common/storage/local-storage.service';
import { Banner, BannerDocument } from './schemas/banner.schema';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

const BANNER_UPLOAD_FOLDER = 'lunara/banners';

@Injectable()
export class BannersService {
  constructor(
    @InjectModel(Banner.name) private bannerModel: Model<BannerDocument>,
    private readonly storageService: LocalStorageService,
  ) {}

  async adminList() {
    const items = await this.bannerModel.find().sort({ sortOrder: 1, createdAt: -1 });
    return { success: true, data: items };
  }

  async create(dto: CreateBannerDto, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Banner image is required');

    const result = await this.storageService.uploadBuffer(
      file.buffer,
      BANNER_UPLOAD_FOLDER,
      `${Date.now()}`,
      'image',
      file.mimetype,
    );

    const banner = await this.bannerModel.create({
      title: dto.title.trim(),
      imageUrl: result.secure_url,
      linkUrl: dto.linkUrl?.trim(),
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      sortOrder: dto.sortOrder ?? 0,
      isActive: true,
    });
    return { success: true, data: banner };
  }

  async update(id: string, dto: UpdateBannerDto) {
    const banner = await this.bannerModel.findById(id);
    if (!banner) throw new NotFoundException('Banner not found');

    if (dto.title !== undefined) banner.title = dto.title.trim();
    if (dto.linkUrl !== undefined) banner.linkUrl = dto.linkUrl.trim();
    if (dto.startsAt !== undefined) banner.startsAt = new Date(dto.startsAt);
    if (dto.endsAt !== undefined) banner.endsAt = new Date(dto.endsAt);
    if (dto.isActive !== undefined) banner.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) banner.sortOrder = dto.sortOrder;
    await banner.save();
    return { success: true, data: banner };
  }

  async updateImage(id: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Banner image is required');
    const banner = await this.bannerModel.findById(id);
    if (!banner) throw new NotFoundException('Banner not found');

    const previousImageUrl = banner.imageUrl;
    const result = await this.storageService.uploadBuffer(
      file.buffer,
      BANNER_UPLOAD_FOLDER,
      `${banner._id.toString()}-${Date.now()}`,
      'image',
      file.mimetype,
    );
    banner.imageUrl = result.secure_url;
    await banner.save();
    await this.storageService.deleteFile(BANNER_UPLOAD_FOLDER, previousImageUrl);
    return { success: true, data: banner };
  }

  async remove(id: string) {
    const banner = await this.bannerModel.findById(id);
    if (!banner) throw new NotFoundException('Banner not found');
    await banner.deleteOne();
    await this.storageService.deleteFile(BANNER_UPLOAD_FOLDER, banner.imageUrl);
    return { success: true, data: { deleted: true } };
  }

  /** Public feed for customer apps — active banners currently within their date window. */
  async listActive() {
    const now = new Date();
    const items = await this.bannerModel
      .find({
        isActive: true,
        $and: [
          { $or: [{ startsAt: { $exists: false } }, { startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gte: now } }] },
        ],
      })
      .sort({ sortOrder: 1, createdAt: -1 });

    return {
      success: true,
      data: items.map((b) => ({
        _id: b._id.toString(),
        title: b.title,
        imageUrl: b.imageUrl,
        linkUrl: b.linkUrl,
      })),
    };
  }
}
