import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { UserRole } from '@lunara/types';
import { User, UserDocument } from './schemas/user.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';

/** Case-insensitive marker seen in a wave of spam signups; matched against the user's email. */
export const SPAM_EMAIL_PATTERN = /APPSBUILDERSPH/i;

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
  ) {}

  /** Deletes users (and their customer profiles) with emails matching the spam marker. */
  async cleanupSpamUsers() {
    const spamUsers = await this.userModel.find({ email: { $regex: SPAM_EMAIL_PATTERN } }).select('_id');
    if (spamUsers.length === 0) return { success: true, data: { deletedCount: 0 } };

    const userIds = spamUsers.map((u) => u._id);
    await this.customerModel.deleteMany({ userId: { $in: userIds } });
    const result = await this.userModel.deleteMany({ _id: { $in: userIds } });
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
