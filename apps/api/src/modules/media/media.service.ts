import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { UserRole } from '@lunara/types';
import { Model } from 'mongoose';
import { LocalStorageService } from '../../common/storage/local-storage.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  assertOrderPortalAccess,
  resolvePortalBranchId,
} from '../partner/partner-access';
import { parseTaskPhotoFilename } from './task-photo-filename';

type MediaCategory = 'rider-documents' | 'task-photos' | 'remittance-proofs';

const FOLDER_BY_CATEGORY: Record<MediaCategory, string> = {
  'rider-documents': 'lunara/rider-documents',
  'task-photos': 'lunara/task-photos',
  'remittance-proofs': 'lunara/remittance-proofs',
};

@Injectable()
export class MediaService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly localStorageService: LocalStorageService,
  ) {}

  resolveFilePath(category: MediaCategory, filename: string): string {
    return this.localStorageService.resolvePrivatePath(FOLDER_BY_CATEGORY[category], filename);
  }

  async assertAccess(
    category: MediaCategory,
    filename: string,
    user: { sub: string; role: UserRole },
  ) {
    if (user.role === UserRole.ADMIN) return;

    if (category === 'rider-documents' || category === 'remittance-proofs') {
      this.assertOwnerPrefixAccess(filename, user);
      return;
    }

    await this.assertTaskPhotoAccess(filename, user);
  }

  private assertOwnerPrefixAccess(filename: string, user: { sub: string; role: UserRole }) {
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
