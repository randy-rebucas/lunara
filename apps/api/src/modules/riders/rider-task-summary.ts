import { Model } from 'mongoose';
import { PARTNER_SHOP_LOCATION } from '@lunara/utils';
import { AddressDocument } from '../addresses/schemas/address.schema';
import { BranchDocument } from '../branches/schemas/branch.schema';
import { CustomerDocument } from '../customers/schemas/customer.schema';
import { OrderDocument } from '../orders/schemas/order.schema';
import { UserDocument } from '../users/schemas/user.schema';

export function formatRiderOrderNumber(orderId: string) {
  return `LN-${orderId.slice(-8).toUpperCase()}`;
}

export function extractSpecialInstructions(order: OrderDocument): string | undefined {
  const fromItems = order.items
    .map((item) => item.notes?.trim())
    .filter(Boolean)
    .join('; ');
  const fromPickup = order.pickup?.notes?.trim();
  const combined = [fromItems, fromPickup].filter(Boolean).join(' · ');
  return combined || undefined;
}

function maskPhone(phone?: string) {
  if (!phone) return undefined;
  return `***${phone.slice(-4)}`;
}

function formatAddressLine(
  addr: Pick<AddressDocument, 'line1' | 'line2' | 'city' | 'province' | 'latitude' | 'longitude'>,
) {
  return {
    line1: addr.line1,
    line2: addr.line2,
    city: addr.city,
    province: addr.province,
    latitude: addr.latitude,
    longitude: addr.longitude,
  };
}

function maskName(name?: string) {
  if (!name) return undefined;
  const [first, ...rest] = name.trim().split(/\s+/);
  const lastInitial = rest.length ? `${rest[rest.length - 1][0]}.` : '';
  return [first, lastInitial].filter(Boolean).join(' ');
}

function maskAddressLine(
  addr: Pick<AddressDocument, 'line1' | 'line2' | 'city' | 'province' | 'latitude' | 'longitude'>,
) {
  return {
    line1: undefined,
    line2: undefined,
    city: addr.city,
    province: addr.province,
    latitude: undefined,
    longitude: undefined,
  };
}

export async function buildRiderTaskDetails(
  order: OrderDocument,
  deps: {
    customerModel: Model<CustomerDocument>;
    branchModel: Model<BranchDocument>;
    userModel: Model<UserDocument>;
    addressModel: Model<AddressDocument>;
  },
  options: {
    includeDialablePhone: boolean;
    customerAddressId: string;
    /** Full customer name and street-level address are only for a rider actually
     * assigned to this task — a rider still just browsing the offer only needs
     * enough to judge the job (first name, city/province), not full PII. */
    isAssigned: boolean;
  },
) {
  const [customer, user, branch, customerAddress] = await Promise.all([
    deps.customerModel.findOne({ userId: order.customerId }).select('firstName lastName'),
    deps.userModel.findById(order.customerId).select('phone'),
    order.branchId ? deps.branchModel.findById(order.branchId) : null,
    deps.addressModel.findById(options.customerAddressId),
  ]);

  const fullCustomerName = customer
    ? `${customer.firstName} ${customer.lastName}`.trim()
    : customerAddress?.label;
  const customerName = options.isAssigned ? fullCustomerName : maskName(fullCustomerName);

  let shopLocation: {
    name: string;
    line1: string;
    city: string;
    province: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  } = {
    name: order.branchName ?? PARTNER_SHOP_LOCATION.name,
    line1: PARTNER_SHOP_LOCATION.line1,
    city: PARTNER_SHOP_LOCATION.city,
    province: PARTNER_SHOP_LOCATION.province,
    postalCode: PARTNER_SHOP_LOCATION.postalCode,
    latitude: PARTNER_SHOP_LOCATION.latitude,
    longitude: PARTNER_SHOP_LOCATION.longitude,
  };

  if (branch) {
    const [lng, lat] = branch.location?.coordinates ?? [];
    shopLocation = {
      name: branch.name,
      line1: branch.line1,
      city: branch.city,
      province: branch.province,
      postalCode: '',
      latitude: lat,
      longitude: lng,
    };
  }

  let shopPhone: string | undefined;
  if (branch?.partnerUserId) {
    const partner = await deps.userModel.findById(branch.partnerUserId).select('phone');
    shopPhone = partner?.phone;
  }

  return {
    orderNumber: formatRiderOrderNumber(order._id.toString()),
    customerName,
    customerPhone: options.includeDialablePhone ? user?.phone : undefined,
    customerPhoneMasked: maskPhone(user?.phone),
    specialInstructions: extractSpecialInstructions(order),
    shopName: shopLocation.name,
    branchCode: order.branchCode ?? branch?.code,
    branchName: order.branchName ?? branch?.name,
    branchLogoUrl: branch?.logoUrl,
    shopLocation,
    shopPhone: options.includeDialablePhone ? shopPhone : undefined,
    shopPhoneMasked: maskPhone(shopPhone),
    customerAddress: customerAddress
      ? options.isAssigned
        ? formatAddressLine(customerAddress)
        : maskAddressLine(customerAddress)
      : null,
  };
}
