import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { OrderStatus, UserRole } from '@lunara/types';
import { isActiveOrderStatus } from '@lunara/utils';
import { User, UserDocument } from './schemas/user.schema';
import { UserProfile, UserProfileDocument } from './schemas/user-profile.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import { Partner, PartnerDocument } from '../partners/schemas/partner.schema';
import { Address, AddressDocument } from '../addresses/schemas/address.schema';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import { Notification, NotificationDocument } from '../reviews/schemas/notification.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';

/** Case-insensitive markers seen in waves of spam signups (each is a fixed prefix/tag followed by
 *  a random suffix); matched against the user's email. Add new confirmed markers here. */
const SPAM_EMAIL_MARKERS = ['APPSBUILDERSPH', 'BITCHASSNIGGA'];
export const SPAM_EMAIL_PATTERN = new RegExp(SPAM_EMAIL_MARKERS.join('|'), 'i');

/**
 * Matches the other recurring bot-signup shape: a gmail.com address whose local part is a
 * flat 6-10 char run of lowercase letters/digits with no separators (dots, plus-tags, underscores)
 * — e.g. "2oilg2pu@gmail.com", "tsmtsifr@gmail.com". Real addresses this short almost always contain
 * a name fragment, a separator, or a longer/more structured handle, so this is a reasonable signal
 * on its own — but since it's fuzzier than the exact-marker match above, cleanup additionally
 * requires zero order history before deleting, so a false positive never destroys real order data.
 */
export const SPAM_RANDOM_GMAIL_PATTERN = /^[a-z0-9]{6,10}@gmail\.com$/i;

export interface UserImportRow {
  email: string;
  phone?: string;
  role: UserRole;
  department?: string;
}

export interface UserImportResult {
  email: string;
  status: 'created' | 'updated' | 'error';
  message?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfileDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(Partner.name) private partnerModel: Model<PartnerDocument>,
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
  ) {}

  /**
   * Guards against deleting a user whose removal would either destroy money (a nonzero wallet
   * balance has nowhere to go) or silently orphan live business state (a partner's branches, or
   * an order actively in progress for a customer/rider). Financial/audit history that merely
   * *references* the user (orders, payments, ledger entries, reviews, support tickets, etc.) is
   * deliberately left alone rather than deleted or nulled — Mongo has no FK constraints, the
   * codebase already reads those joins defensively (missing user = blank display field, never a
   * crash), and destroying that history would be worse than a stale ObjectId pointing at a
   * deleted account.
   */
  private async assertSafeToDelete(user: UserDocument): Promise<void> {
    const wallet = await this.walletModel.findOne({ userId: user._id }).select('balance');
    if (wallet && wallet.balance > 0) {
      throw new BadRequestException(
        `${user.email ?? user._id.toString()} has a wallet balance of ₱${wallet.balance} — settle or withdraw it before deleting this account`,
      );
    }

    if (user.role === UserRole.PARTNER) {
      const branchCount = await this.branchModel.countDocuments({ partnerUserId: user._id });
      if (branchCount > 0) {
        throw new BadRequestException(
          `${user.email ?? user._id.toString()} still owns ${branchCount} branch(es) — reassign or remove them before deleting this account`,
        );
      }
    }

    if (user.role === UserRole.CUSTOMER) {
      const activeStatuses = Object.values(OrderStatus).filter(isActiveOrderStatus);
      const hasActiveOrder = await this.orderModel.exists({
        customerId: user._id,
        status: { $in: activeStatuses },
      });
      if (hasActiveOrder) {
        throw new BadRequestException(
          `${user.email ?? user._id.toString()} has an order in progress — wait for it to complete or cancel it before deleting this account`,
        );
      }
    }

    if (user.role === UserRole.RIDER) {
      const activeStatuses = Object.values(OrderStatus).filter(isActiveOrderStatus);
      const hasActiveOrder = await this.orderModel.exists({
        $or: [{ pickupRiderId: user._id }, { deliveryRiderId: user._id }],
        status: { $in: activeStatuses },
      });
      if (hasActiveOrder) {
        throw new BadRequestException(
          `${user.email ?? user._id.toString()} has an order in progress — reassign it before deleting this account`,
        );
      }
    }
  }

  /** Deletes every document that exists solely to extend this User (profile-shaped join
   * collections), once assertSafeToDelete has cleared it. Does not touch financial/order/audit
   * history — see assertSafeToDelete's doc comment.
   *
   * `force` additionally hard-deletes a partner's branches (a no-op for non-partners, since the
   * filter matches nothing) — only reachable when assertSafeToDelete was bypassed, i.e. an admin
   * explicitly chose to override the "still owns branches" guard. This orphans the branchId
   * reference on any orders that branch had; that data loss is the deliberate cost of forcing
   * past the guard, not a side effect anyone should hit by accident. */
  private async cascadeDeleteUserData(userId: Types.ObjectId, force = false): Promise<void> {
    await Promise.all([
      this.customerModel.deleteOne({ userId }),
      this.riderModel.deleteOne({ userId }),
      this.partnerModel.deleteOne({ ownerUserId: userId }),
      this.userProfileModel.deleteOne({ userId }),
      this.addressModel.deleteMany({ userId }),
      this.walletModel.deleteOne({ userId }),
      this.notificationModel.deleteMany({ userId }),
      ...(force ? [this.branchModel.deleteMany({ partnerUserId: userId })] : []),
    ]);
  }

  /**
   * Deletes users (and their customer profiles) matching known spam-signup patterns.
   * Exact-marker matches (SPAM_EMAIL_PATTERN) are deleted unconditionally. Fuzzy matches
   * (SPAM_RANDOM_GMAIL_PATTERN) are only deleted if the account has no order history, so a
   * false-positive match on a real random-looking gmail address never destroys real orders.
   */
  async cleanupSpamUsers() {
    const markedUsers = await this.userModel
      .find({ email: { $regex: SPAM_EMAIL_PATTERN } })
      .select('_id');

    const fuzzyCandidates = await this.userModel
      .find({ role: UserRole.CUSTOMER, email: { $regex: SPAM_RANDOM_GMAIL_PATTERN } })
      .select('_id');

    const toDelete = [...markedUsers.map((u) => u._id)];
    for (const candidate of fuzzyCandidates) {
      // Order.customerId stores the User._id directly (see orders.service.ts/partner-demo-data
      // seeding — never Customer._id), so the check must compare against candidate._id itself.
      const hasOrders = (await this.orderModel.exists({ customerId: candidate._id })) !== null;
      if (!hasOrders) toDelete.push(candidate._id);
    }

    if (toDelete.length === 0) return { success: true, data: { deletedCount: 0 } };

    await Promise.all(toDelete.map((id) => this.cascadeDeleteUserData(id as Types.ObjectId)));
    const result = await this.userModel.deleteMany({ _id: { $in: toDelete } });
    return { success: true, data: { deletedCount: result.deletedCount } };
  }

  /** Deletes the given users and everything that exists solely to extend them (customer/rider/
   * partner profiles, addresses, wallet, notifications) — see cascadeDeleteUserData. Skips (not
   * fails) any user that assertSafeToDelete rejects — a nonzero wallet balance, a partner that
   * still owns branches, or an active order — so one bad row in a bulk selection doesn't block
   * the rest. Financial/order/audit history that only references the user is left untouched.
   *
   * `force: true` bypasses every assertSafeToDelete check (wallet balance, owned branches, active
   * orders) and additionally hard-deletes a partner's branches — a deliberate, explicit admin
   * override, not a default. The caller (admin-web) should only offer this after the guarded
   * attempt has already reported exactly what would be destroyed. */
  async bulkDelete(ids: string[], force = false) {
    if (!ids.length) throw new BadRequestException('No user ids provided');
    const users = await this.userModel.find({ _id: { $in: ids } });

    const deletedIds: string[] = [];
    const skipped: { id: string; email?: string; reason: string }[] = [];
    for (const user of users) {
      try {
        if (!force) await this.assertSafeToDelete(user);
        await this.cascadeDeleteUserData(user._id as Types.ObjectId, force);
        deletedIds.push(user._id.toString());
      } catch (err) {
        skipped.push({
          id: user._id.toString(),
          email: user.email,
          reason: err instanceof Error ? err.message : 'Could not delete this account',
        });
      }
    }

    if (deletedIds.length > 0) {
      await this.userModel.deleteMany({ _id: { $in: deletedIds } });
    }
    return { success: true, data: { deletedCount: deletedIds.length, deletedIds, skipped } };
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).select('-passwordHash');
    if (!user) throw new NotFoundException('User not found');
    return { success: true, data: user };
  }

  async findAll(department?: string) {
    const filter = department ? { department } : {};
    const users = await this.userModel
      .find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .limit(2000);
    return { success: true, data: users };
  }

  async setActive(userId: string, isActive: boolean) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true },
    ).select('-passwordHash');
    if (!user) throw new NotFoundException('User not found');
    return { success: true, data: user };
  }

  async bulkSetActive(ids: string[], isActive: boolean) {
    if (!ids.length) throw new BadRequestException('No user ids provided');
    await this.userModel.updateMany({ _id: { $in: ids } }, { isActive });
    const users = await this.userModel.find({ _id: { $in: ids } }).select('-passwordHash');
    return { success: true, data: users };
  }

  async setDepartment(userId: string, department: string) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { department },
      { new: true },
    ).select('-passwordHash');
    if (!user) throw new NotFoundException('User not found');
    return { success: true, data: user };
  }

  async setPhoto(userId: string, photoUrl: string) {
    const previous = await this.userModel.findById(userId).select('photoUrl');
    if (!previous) throw new NotFoundException('User not found');
    const previousUrl = previous.photoUrl;
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { photoUrl },
      { new: true },
    ).select('-passwordHash');
    return { success: true, data: user, previousUrl };
  }

  async bulkImport(rows: UserImportRow[]): Promise<{ success: true; data: UserImportResult[] }> {
    if (!rows.length) throw new BadRequestException('No rows to import');
    const results: UserImportResult[] = [];
    for (const row of rows) {
      const email = row.email?.trim().toLowerCase();
      if (!email) {
        results.push({ email: row.email ?? '', status: 'error', message: 'Missing email' });
        continue;
      }
      try {
        const existing = await this.userModel.findOne({ email });
        if (existing) {
          existing.role = row.role;
          if (row.phone) existing.phone = row.phone;
          if (row.department) existing.department = row.department;
          await existing.save();
          results.push({ email, status: 'updated' });
        } else {
          const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 12);
          await this.userModel.create({
            email,
            phone: row.phone,
            role: row.role,
            department: row.department,
            passwordHash,
            isActive: true,
          });
          results.push({ email, status: 'created' });
        }
      } catch (err) {
        results.push({ email, status: 'error', message: err instanceof Error ? err.message : 'Import failed' });
      }
    }
    return { success: true, data: results };
  }
}
