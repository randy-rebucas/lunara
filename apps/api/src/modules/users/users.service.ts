import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { UserRole } from '@lunara/types';
import { User, UserDocument } from './schemas/user.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';

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
  ) {}

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
      const customer = await this.customerModel.findOne({ userId: candidate._id }).select('_id');
      const hasOrders = customer
        ? (await this.orderModel.exists({ customerId: customer._id })) !== null
        : false;
      if (!hasOrders) toDelete.push(candidate._id);
    }

    if (toDelete.length === 0) return { success: true, data: { deletedCount: 0 } };

    await this.customerModel.deleteMany({ userId: { $in: toDelete } });
    const result = await this.userModel.deleteMany({ _id: { $in: toDelete } });
    return { success: true, data: { deletedCount: result.deletedCount } };
  }

  /** Deletes the given users and their customer profiles outright, no safety checks — the caller
   *  (an admin explicitly selecting rows) is the safety check. */
  async bulkDelete(ids: string[]) {
    if (!ids.length) throw new BadRequestException('No user ids provided');
    await this.customerModel.deleteMany({ userId: { $in: ids } });
    const result = await this.userModel.deleteMany({ _id: { $in: ids } });
    return { success: true, data: { deletedCount: result.deletedCount } };
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
