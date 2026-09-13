import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { Address, AddressDocument } from './schemas/address.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';

const NON_TERMINAL_ORDER_STATUSES = Object.values(OrderStatus).filter(
  (status) => ![OrderStatus.DELIVERED, OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED].includes(
    status,
  ),
);

/**
 * Older customer-mobile builds JSON-encoded `landmark`/`notes` into `line2`
 * (`{"line2":"...","landmark":"...","notes":"..."}`) instead of using the real `landmark` and
 * `deliveryInstructions` fields. Detect and repair those on read so every consumer (rider/partner/
 * admin included) sees plain text instead of a raw JSON blob.
 */
async function healLegacyLine2(address: AddressDocument): Promise<AddressDocument> {
  if (!address.line2 || !address.line2.startsWith('{')) return address;
  try {
    const parsed = JSON.parse(address.line2) as { line2?: string; landmark?: string; notes?: string };
    address.line2 = parsed.line2 || undefined;
    address.landmark = address.landmark ?? parsed.landmark ?? undefined;
    address.deliveryInstructions = address.deliveryInstructions ?? parsed.notes ?? undefined;
    await address.save();
  } catch {
    // not actually JSON — leave as-is
  }
  return address;
}

@Injectable()
export class AddressesService {
  constructor(
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  async findAll(userId: string) {
    const items = await this.addressModel.find({ userId: new Types.ObjectId(userId) });
    const healed = await Promise.all(items.map(healLegacyLine2));
    return { success: true, data: healed };
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
    return { success: true, data: await healLegacyLine2(address) };
  }

  async remove(id: string, userId: string) {
    const address = await this.addressModel.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!address) throw new NotFoundException('Address not found');

    const activeOrder = await this.orderModel.findOne({
      $or: [{ pickupAddressId: id }, { deliveryAddressId: id }],
      status: { $in: NON_TERMINAL_ORDER_STATUSES },
    });
    if (activeOrder) {
      throw new BadRequestException(
        'This address is used by an order that is still in progress and cannot be deleted.',
      );
    }

    await address.deleteOne();
    return { success: true, data: { deleted: true } };
  }
}
