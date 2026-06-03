export interface PartnerCoverageInfo {
  hasPartnerNearby: boolean;
  inServiceArea: boolean;
  message: string | null;
}

export function buildPartnerCoverageNotice(params: {
  inServiceArea: boolean;
  hasPartnerNearby: boolean;
  branchAssigned: boolean;
  nearestDistanceLabel?: string;
}): PartnerCoverageInfo {
  if (params.branchAssigned) {
    return { hasPartnerNearby: true, inServiceArea: true, message: null };
  }

  if (!params.inServiceArea) {
    return {
      hasPartnerNearby: false,
      inServiceArea: false,
      message:
        'No partner laundry serves your pickup location yet. Lunara will review your area and notify you when coverage is available.',
    };
  }

  if (!params.hasPartnerNearby) {
    const distanceHint = params.nearestDistanceLabel
      ? ` (nearest partner shop is ${params.nearestDistanceLabel} away)`
      : '';
    return {
      hasPartnerNearby: false,
      inServiceArea: true,
      message: `No partner laundry is within service range of your address${distanceHint}. Our team may assign a shop manually — pickup could take longer than usual.`,
    };
  }

  return { hasPartnerNearby: true, inServiceArea: true, message: null };
}
