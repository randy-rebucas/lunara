export interface RiderTaskAddress {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  province?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface RiderShopLocation {
  name: string;
  line1: string;
  city: string;
  province?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface RiderTaskDetailsFields {
  orderNumber?: string;
  bookingType: string;
  estimatedWeightKg?: number;
  specialInstructions?: string;
  customerName?: string;
  customerPhone?: string;
  customerPhoneMasked?: string;
  customerAddress?: RiderTaskAddress | null;
  shopName?: string;
  branchName?: string;
  branchCode?: string;
  shopLocation?: RiderShopLocation | null;
  shopPhone?: string;
  shopPhoneMasked?: string;
  canReject?: boolean;
}
