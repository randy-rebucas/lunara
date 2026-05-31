import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { UserRole } from '@lunara/types';
import { OrderDocument } from '../orders/schemas/order.schema';
import { UserDocument } from '../users/schemas/user.schema';

export async function resolvePortalBranchId(
  userModel: Model<UserDocument>,
  userId: string,
  role: UserRole,
): Promise<Types.ObjectId | undefined> {
  if (role !== UserRole.STAFF) return undefined;
  const user = await userModel.findById(userId).select('branchId');
  return user?.branchId ?? undefined;
}

export function applyStaffBranchFilter(
  filter: Record<string, unknown>,
  role: UserRole,
  branchId?: Types.ObjectId,
): void {
  if (role === UserRole.STAFF) {
    if (!branchId) {
      filter.branchId = { $exists: false, $eq: null };
      return;
    }
    filter.branchId = branchId;
  }
}

export function assertOrderPortalAccess(
  order: OrderDocument,
  userId: string,
  role: UserRole,
  staffBranchId?: Types.ObjectId,
): void {
  if (role === UserRole.ADMIN) return;

  if (role === UserRole.PARTNER) {
    if (order.partnerId?.toString() && order.partnerId.toString() !== userId) {
      throw new BadRequestException('Order belongs to another partner');
    }
    return;
  }

  if (role === UserRole.STAFF) {
    if (!staffBranchId) {
      throw new ForbiddenException('Staff account has no branch assignment');
    }
    if (order.branchId?.toString() !== staffBranchId.toString()) {
      throw new ForbiddenException('Order is not at your branch');
    }
    return;
  }

  throw new ForbiddenException('Not allowed to access this order');
}
