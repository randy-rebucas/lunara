import { BookingType } from '@lunara/types';

export interface CustomerLocationEvaluation {
  city: string;
  line1: string;
  province: string;
  latitude?: number;
  longitude?: number;
}

export interface BranchCapacityEvaluation {
  activeOrders: number;
  maxActiveOrders: number;
  utilizationPercent: number;
  available: boolean;
  label: string;
}

export interface BranchPerformanceEvaluation {
  score: number;
  label: string;
  completedOrders30d: number;
  onTimeRatePercent: number;
}

export interface BranchAvailabilityEvaluation {
  isActive: boolean;
  withinServiceRadius: boolean;
  acceptingOrders: boolean;
  label: string;
}

export interface BranchDispatchEvaluation {
  branchId: string;
  code: string;
  name: string;
  city: string;
  distanceKm: number;
  distanceLabel: string;
  customerLocation: CustomerLocationEvaluation & {
    distanceKm: number;
    distanceLabel: string;
    withinServiceRadius: boolean;
  };
  capacity: BranchCapacityEvaluation;
  performance: BranchPerformanceEvaluation;
  availability: BranchAvailabilityEvaluation;
  estimatedTurnaroundHours: number;
  estimatedTurnaroundLabel: string;
  recommendationScore: number;
  rank: number;
  isRecommended: boolean;
}

const BASE_TURNAROUND_HOURS: Record<string, number> = {
  [BookingType.WASH_FOLD]: 24,
  [BookingType.WASH_DRY]: 28,
  [BookingType.WASH_DRY_FOLD]: 30,
  [BookingType.WASH_DRY_FOLD_IRON]: 36,
  [BookingType.DRY_CLEANING]: 48,
  [BookingType.COMFORTERS]: 48,
  [BookingType.CURTAINS]: 72,
  [BookingType.SHOES]: 72,
  [BookingType.UNIFORMS]: 36,
};

export function estimateTurnaroundHours(
  bookingType: string,
  estimatedWeightKg: number,
  activeOrdersAtShop: number,
): { hours: number; label: string } {
  const base = BASE_TURNAROUND_HOURS[bookingType] ?? 36;
  const weightFactor = Math.max(0, (estimatedWeightKg - 5) * 0.5);
  const queueFactor = activeOrdersAtShop * 1.5;
  const hours = Math.round(base + weightFactor + queueFactor);
  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  const label =
    days > 0
      ? `~${days}d ${remainder > 0 ? `${remainder}h` : ''}`.trim()
      : `~${hours}h`;
  return { hours, label };
}

export function scoreBranchPerformance(
  completedOrders30d: number,
  onTimeRatePercent: number,
): BranchPerformanceEvaluation {
  const volumeScore = Math.min(100, completedOrders30d * 4);
  const onTimeScore = onTimeRatePercent;
  const score = Math.round(volumeScore * 0.4 + onTimeScore * 0.6);
  let label = 'Good';
  if (score >= 85) label = 'Excellent';
  else if (score >= 70) label = 'Good';
  else if (score >= 50) label = 'Fair';
  else label = 'Needs attention';

  return {
    score,
    label,
    completedOrders30d,
    onTimeRatePercent,
  };
}

export function buildCapacityEvaluation(
  activeOrders: number,
  maxActiveOrders: number,
): BranchCapacityEvaluation {
  const utilizationPercent =
    maxActiveOrders > 0 ? Math.round((activeOrders / maxActiveOrders) * 100) : 100;
  const available = activeOrders < maxActiveOrders;
  const label = available
    ? `${activeOrders}/${maxActiveOrders} active (${utilizationPercent}% full)`
    : `At capacity (${activeOrders}/${maxActiveOrders})`;

  return { activeOrders, maxActiveOrders, utilizationPercent, available, label };
}

export function buildAvailabilityEvaluation(
  isActive: boolean,
  withinServiceRadius: boolean,
  capacityAvailable: boolean,
): BranchAvailabilityEvaluation {
  const acceptingOrders = isActive && withinServiceRadius && capacityAvailable;
  let label = 'Available';
  if (!isActive) label = 'Shop inactive';
  else if (!withinServiceRadius) label = 'Outside service radius';
  else if (!capacityAvailable) label = 'At capacity';

  return {
    isActive,
    withinServiceRadius,
    acceptingOrders,
    label,
  };
}

export interface RankBranchInput {
  branchId: string;
  code: string;
  name: string;
  city: string;
  distanceKm: number;
  distanceLabel: string;
  withinRadius: boolean;
  activeOrders: number;
  maxActiveOrders: number;
  capacityAvailable: boolean;
  isActive: boolean;
  performance: BranchPerformanceEvaluation;
  bookingType: string;
  estimatedWeightKg: number;
  customerLocation: CustomerLocationEvaluation;
}

/** Weighted score for admin dispatch ranking (higher = better fit). */
export function computeRecommendationScore(input: {
  distanceKm: number;
  maxRadiusKm: number;
  capacityAvailable: boolean;
  utilizationPercent: number;
  performanceScore: number;
  withinRadius: boolean;
  isActive: boolean;
}): number {
  const distanceScore = Math.max(
    0,
    100 - (input.distanceKm / Math.max(input.maxRadiusKm, 1)) * 100,
  );
  const capacityScore = input.capacityAvailable
    ? Math.max(0, 100 - input.utilizationPercent)
    : 0;
  const perfScore = input.performanceScore;
  const availScore =
    input.isActive && input.withinRadius ? 100 : input.isActive ? 40 : 0;

  return Math.round(
    distanceScore * 0.3 +
      capacityScore * 0.25 +
      perfScore * 0.25 +
      availScore * 0.2,
  );
}

export function rankBranchesForDispatch(
  branches: RankBranchInput[],
): BranchDispatchEvaluation[] {
  const scored = branches.map((b) => {
    const capacity = buildCapacityEvaluation(b.activeOrders, b.maxActiveOrders);
    const availability = buildAvailabilityEvaluation(
      b.isActive,
      b.withinRadius,
      b.capacityAvailable,
    );
    const turnaround = estimateTurnaroundHours(
      b.bookingType,
      b.estimatedWeightKg,
      b.activeOrders,
    );
    const recommendationScore = computeRecommendationScore({
      distanceKm: b.distanceKm,
      maxRadiusKm: 15,
      capacityAvailable: b.capacityAvailable,
      utilizationPercent: capacity.utilizationPercent,
      performanceScore: b.performance.score,
      withinRadius: b.withinRadius,
      isActive: b.isActive,
    });

    return {
      branchId: b.branchId,
      code: b.code,
      name: b.name,
      city: b.city,
      distanceKm: b.distanceKm,
      distanceLabel: b.distanceLabel,
      customerLocation: {
        ...b.customerLocation,
        distanceKm: b.distanceKm,
        distanceLabel: b.distanceLabel,
        withinServiceRadius: b.withinRadius,
      },
      capacity,
      performance: b.performance,
      availability,
      estimatedTurnaroundHours: turnaround.hours,
      estimatedTurnaroundLabel: turnaround.label,
      recommendationScore,
      rank: 0,
      isRecommended: false,
    };
  });

  scored.sort((a, b) => b.recommendationScore - a.recommendationScore);
  scored.forEach((s, i) => {
    s.rank = i + 1;
    s.isRecommended = i === 0 && s.availability.acceptingOrders;
  });

  return scored;
}
