import { useCallback, useEffect, useState } from 'react';
import { partnerFetch } from './partner-api';
import { usePartnerQuery } from './use-partner-query';

export type PricingMode = 'flat_bag' | 'per_kg' | 'per_load' | 'per_piece' | 'per_pair' | 'per_item' | 'fixed';

export interface BranchOption {
  _id: string;
  code: string;
  name: string;
  branchType: string;
  city: string;
}

export interface ShopServicePrice {
  type: string;
  label: string;
  category?: string;
  basePricePerKg: number;
  basePricePerLoad?: number;
  basePricePerPiece?: number;
  basePricePerPair?: number;
  basePricePerItem?: number;
  fixedPrice?: number;
  pricingUnit?: PricingMode;
  customerPricePerKg: number;
  isCustom?: boolean;
  customServiceId?: string;
}

export interface ShopAddonPrice {
  slug: string;
  label: string;
  category?: string;
  basePrice: number;
  basePricePerKg?: number;
  basePricePerLoad?: number;
  basePricePerPiece?: number;
  basePricePerPair?: number;
  basePricePerItem?: number;
  fixedPrice?: number;
  pricingUnit?: PricingMode;
  /** Global-catalog-only — not partner-configurable, unlike pricingUnit. */
  isPercentOfService?: boolean;
  customerPrice: number;
  isCustom?: boolean;
  customAddonId?: string;
  applicableServiceTypes?: string[];
  allowsQuantity?: boolean;
  maxQuantity?: number;
  /** Units of this add-on bundled free into the service — only quantity beyond this is billed. */
  includedQuantity?: number;
}

export interface ShopGarmentItem {
  id: string;
  category: string;
  label: string;
  price: number;
}

export interface ShopPricing {
  pricingMode: PricingMode;
  kgPerLoad: number;
  services: ShopServicePrice[];
  addons: ShopAddonPrice[];
  garmentCatalog: ShopGarmentItem[];
  hiddenServiceTypes: string[];
  hiddenAddonSlugs: string[];
  hiddenGarmentItemIds: string[];
}

/** Shared branch-selection + pricing-fetch logic used by both the Services (catalog) and Pricing
 * (rates) pages, which edit different slices of the same per-branch pricing document. */
export function useShopPricing() {
  const loadBranches = useCallback(async () => {
    return partnerFetch<BranchOption[]>('/partner/branches');
  }, []);
  const {
    data: branches,
    loading: branchesLoading,
    error: branchesError,
    reload: reloadBranches,
  } = usePartnerQuery(loadBranches, []);

  const [selectedBranchId, setSelectedBranchId] = useState('');
  useEffect(() => {
    if (!selectedBranchId && branches && branches.length > 0) {
      setSelectedBranchId(branches[0]._id);
    }
  }, [branches, selectedBranchId]);

  const loadPricing = useCallback(async () => {
    if (!selectedBranchId) return null;
    return partnerFetch<ShopPricing>(`/partner/branches/${selectedBranchId}/pricing`);
  }, [selectedBranchId]);
  const {
    data: pricing,
    loading: pricingLoading,
    error: pricingError,
    reload: reloadPricing,
  } = usePartnerQuery(loadPricing, [selectedBranchId]);

  return {
    branches,
    branchesLoading,
    branchesError,
    reloadBranches,
    selectedBranchId,
    setSelectedBranchId,
    pricing,
    pricingLoading,
    pricingError,
    reloadPricing,
  };
}
