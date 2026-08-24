import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import { AddressesService } from '../addresses/addresses.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { OTP_PROFILE_PLACEHOLDER_FIRST_NAME, OTP_PROFILE_PLACEHOLDER_LAST_NAME } from './customers.constants';
import { UpdateCustomerDto } from './dto/customer.dto';
import { Customer, CustomerDocument } from './schemas/customer.schema';

/** Rough estimate: kg CO2-equivalent saved per kg laundered via efficient bulk shop washing
 * vs. the average at-home per-load wash — shown to customers as an estimate, not a certified figure. */
const CO2_SAVED_KG_PER_KG_LAUNDERED = 0.6;

const COMPLETED_STATUSES = [OrderStatus.COMPLETED, OrderStatus.DELIVERED];

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly addressesService: AddressesService,
  ) {}

  async create(userId: string, firstName: string, lastName: string) {
    return this.customerModel.create({
      userId: new Types.ObjectId(userId),
      firstName,
      lastName,
      loyaltyPoints: 0,
    });
  }

  async findByUserId(userId: string) {
    return this.customerModel.findOne({ userId: new Types.ObjectId(userId) });
  }

  needsProfileCompletion(customer: CustomerDocument | null) {
    return !customer || customer.firstName === OTP_PROFILE_PLACEHOLDER_FIRST_NAME;
  }

  async getProfile(userId: string) {
    const customer = await this.findByUserId(userId);
    if (!customer) throw new NotFoundException('Customer profile not found');
    return { success: true, data: customer };
  }

  async updateProfile(userId: string, dto: UpdateCustomerDto) {
    let customer = await this.findByUserId(userId);
    if (!customer) {
      customer = await this.customerModel.create({
        userId: new Types.ObjectId(userId),
        firstName: dto.firstName?.trim() ?? OTP_PROFILE_PLACEHOLDER_FIRST_NAME,
        lastName: dto.lastName?.trim() ?? OTP_PROFILE_PLACEHOLDER_LAST_NAME,
        loyaltyPoints: 0,
      });
      return { success: true, data: customer };
    }
    if (dto.firstName) customer.firstName = dto.firstName.trim();
    if (dto.lastName) customer.lastName = dto.lastName.trim();
    if (dto.isBusiness !== undefined) customer.isBusiness = dto.isBusiness;
    if (dto.notificationPreferences) {
      customer.notificationPreferences = {
        push: dto.notificationPreferences.push ?? customer.notificationPreferences?.push ?? true,
        email: dto.notificationPreferences.email ?? customer.notificationPreferences?.email ?? true,
      };
    }
    await customer.save();
    return { success: true, data: customer };
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const customer = await this.findByUserId(userId);
    if (!customer) throw new NotFoundException('Customer profile not found');

    const previousAvatarUrl = customer.avatarUrl;
    customer.avatarUrl = avatarUrl;
    await customer.save();
    return { success: true, data: customer, previousAvatarUrl };
  }

  /** Consolidated per-month order count/spend for the last 12 months — the minimal "business
   * portal" slice: no multi-user org, just a summary view gated behind the isBusiness flag. */
  async getBusinessSummary(userId: string) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const rows = await this.orderModel.aggregate([
      {
        $match: {
          customerId: new Types.ObjectId(userId),
          status: { $in: COMPLETED_STATUSES },
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          orderCount: { $sum: 1 },
          totalSpend: { $sum: { $ifNull: ['$finalTotal', '$total'] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const months = rows.map((r) => ({
      month: r._id as string,
      orderCount: r.orderCount as number,
      totalSpend: r.totalSpend as number,
    }));

    return {
      success: true,
      data: {
        months,
        totalOrders: months.reduce((sum, m) => sum + m.orderCount, 0),
        totalSpend: months.reduce((sum, m) => sum + m.totalSpend, 0),
      },
    };
  }

  /** Rough sustainability estimate derived from laundered weight already on file — no new
   * order-time data capture needed. */
  async getImpactSummary(userId: string) {
    const [result] = await this.orderModel.aggregate([
      {
        $match: {
          customerId: new Types.ObjectId(userId),
          status: { $in: COMPLETED_STATUSES },
        },
      },
      {
        $group: {
          _id: null,
          totalWeightKg: {
            $sum: { $ifNull: ['$pickup.actualWeightKg', '$estimatedWeightKg'] },
          },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const totalWeightKg = result?.totalWeightKg ?? 0;
    const orderCount = result?.orderCount ?? 0;

    return {
      success: true,
      data: {
        totalWeightKg: Math.round(totalWeightKg * 10) / 10,
        orderCount,
        estimatedCo2SavedKg: Math.round(totalWeightKg * CO2_SAVED_KG_PER_KG_LAUNDERED * 10) / 10,
      },
    };
  }

  async getOnboardingStatus(userId: string) {
    const customer = await this.findByUserId(userId);
    const needsProfile = this.needsProfileCompletion(customer);
    const addresses = await this.addressesService.findAll(userId);
    const needsAddress = addresses.data.length === 0;
    return {
      success: true,
      data: { needsProfile, needsAddress, isComplete: !needsProfile && !needsAddress },
    };
  }
}
