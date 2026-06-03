import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { UserRole } from '@lunara/types';
import { createReadStream, existsSync } from 'fs';
import { extname } from 'path';
import { Model } from 'mongoose';
import {
  riderDocumentFilePath,
  taskPhotoFilePath,
} from '../../common/uploads/upload-paths';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  assertOrderPortalAccess,
  resolvePortalBranchId,
} from '../partner/partner-access';
import { parseTaskPhotoFilename } from './task-photo-filename';

type MediaCategory = 'rider-documents' | 'task-photos';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

@Injectable()
export class MediaService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  resolveFile(category: MediaCategory, filename: string) {
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new NotFoundException('File not found');
    }

    const filePath =
      category === 'rider-documents'
        ? riderDocumentFilePath(filename)
        : taskPhotoFilePath(filename);

    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    const ext = extname(filename).toLowerCase();
    return {
      stream: createReadStream(filePath),
      contentType: MIME_BY_EXT[ext] ?? 'application/octet-stream',
    };
  }

  async assertAccess(
    category: MediaCategory,
    filename: string,
    user: { sub: string; role: UserRole },
  ) {
    if (user.role === UserRole.ADMIN) return;

    if (category === 'rider-documents') {
      this.assertRiderDocumentAccess(filename, user);
      return;
    }

    await this.assertTaskPhotoAccess(filename, user);
  }

  private assertRiderDocumentAccess(filename: string, user: { sub: string; role: UserRole }) {
    const ownerPrefix = `${user.sub}-`;
    if (!filename.startsWith(ownerPrefix)) {
      throw new ForbiddenException('Access denied');
    }
    if (user.role !== UserRole.RIDER) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async assertTaskPhotoAccess(
    filename: string,
    user: { sub: string; role: UserRole },
  ) {
    if (filename.startsWith(`${user.sub}-`)) return;

    const parsed = parseTaskPhotoFilename(filename);
    if (!parsed) {
      throw new ForbiddenException('Access denied');
    }

    const order = await this.orderModel
      .findById(parsed.orderId)
      .select('customerId pickupRiderId deliveryRiderId branchId partnerId');
    if (!order) {
      throw new ForbiddenException('Access denied');
    }

    if (user.role === UserRole.CUSTOMER && order.customerId.toString() === user.sub) {
      return;
    }

    if (user.role === UserRole.RIDER) {
      const isPickupRider = order.pickupRiderId?.toString() === user.sub;
      const isDeliveryRider = order.deliveryRiderId?.toString() === user.sub;
      if (isPickupRider || isDeliveryRider) return;
    }

    if (user.role === UserRole.PARTNER || user.role === UserRole.STAFF) {
      const branchId = await resolvePortalBranchId(this.userModel, user.sub, user.role);
      assertOrderPortalAccess(order, user.sub, user.role, branchId);
      return;
    }

    throw new ForbiddenException('Access denied');
  }
}
