import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { Address, AddressDocument } from './schemas/address.schema';

@Injectable()
export class AddressesService {
  constructor(@InjectModel(Address.name) private addressModel: Model<AddressDocument>) {}

  async findAll(userId: string) {
    const items = await this.addressModel.find({ userId: new Types.ObjectId(userId) });
    return { success: true, data: items };
  }

  async create(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.addressModel.updateMany(
        { userId: new Types.ObjectId(userId) },
        { isDefault: false },
      );
    }
    const address = await this.addressModel.create({
      userId: new Types.ObjectId(userId),
      ...dto,
    });
    return { success: true, data: address };
  }

  async update(id: string, userId: string, dto: UpdateAddressDto) {
    const address = await this.addressModel.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!address) throw new NotFoundException('Address not found');

    if (dto.isDefault) {
      await this.addressModel.updateMany(
        { userId: new Types.ObjectId(userId) },
        { isDefault: false },
      );
    }
    // class-transformer instantiates the DTO with every declared field present
    // (set to undefined when omitted from the request body) — a plain
    // Object.assign would overwrite untouched required fields with undefined.
    const updates = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    Object.assign(address, updates);
    await address.save();
    return { success: true, data: address };
  }

  async remove(id: string, userId: string) {
    const result = await this.addressModel.deleteOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!result.deletedCount) throw new NotFoundException('Address not found');
    return { success: true, data: { deleted: true } };
  }
}
