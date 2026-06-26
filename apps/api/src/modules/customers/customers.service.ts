import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { existsSync, unlinkSync } from 'fs';
import { Model, Types } from 'mongoose';
import { basename } from 'path';
import { AddressesService } from '../addresses/addresses.service';
import { avatarFilePath, AVATAR_PUBLIC_PREFIX } from '../../common/uploads/upload-paths';
import { OTP_PROFILE_PLACEHOLDER_FIRST_NAME, OTP_PROFILE_PLACEHOLDER_LAST_NAME } from './customers.constants';
import { UpdateCustomerDto } from './dto/customer.dto';
import { Customer, CustomerDocument } from './schemas/customer.schema';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
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
    await customer.save();
    return { success: true, data: customer };
  }

  async updateAvatar(userId: string, filename: string) {
    const customer = await this.findByUserId(userId);
    if (!customer) throw new NotFoundException('Customer profile not found');

    if (customer.avatarUrl?.startsWith(AVATAR_PUBLIC_PREFIX)) {
      const oldFilename = basename(customer.avatarUrl);
      const oldPath = avatarFilePath(oldFilename);
      if (existsSync(oldPath)) {
        unlinkSync(oldPath);
      }
    }

    customer.avatarUrl = `${AVATAR_PUBLIC_PREFIX}/${filename}`;
    await customer.save();
    return { success: true, data: customer };
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
