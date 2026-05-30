import { OrderStatus } from '@lunara/types';

export type LaundryProcessingStepId =
  | 'received'
  | 'sorting'
  | 'washing'
  | 'drying'
  | 'folding'
  | 'ironing'
  | 'quality_check'
  | 'ready_for_delivery';

export interface LaundryProcessingStep {
  id: LaundryProcessingStepId;
  label: string;
  description: string;
  /** Order status applied when this step is completed. */
  orderStatus: OrderStatus;
  optional?: boolean;
}

/** Partner laundry processing after shop receiving (`received_at_shop`). */
export const LAUNDRY_PROCESSING_STEPS: LaundryProcessingStep[] = [
  {
    id: 'received',
    label: 'Received',
    description: 'Laundry logged and ready for processing',
    orderStatus: OrderStatus.RECEIVED,
  },
  {
    id: 'sorting',
    label: 'Sorting',
    description: 'Sort by fabric, color, and service type',
    orderStatus: OrderStatus.SORTING,
  },
  {
    id: 'washing',
    label: 'Washing',
    description: 'Wash per service instructions',
    orderStatus: OrderStatus.WASHING,
  },
  {
    id: 'drying',
    label: 'Drying',
    description: 'Machine or air dry',
    orderStatus: OrderStatus.DRYING,
  },
  {
    id: 'folding',
    label: 'Folding',
    description: 'Fold and organize items',
    orderStatus: OrderStatus.FOLDING,
  },
  {
    id: 'ironing',
    label: 'Ironing',
    description: 'Press and iron (optional)',
    orderStatus: OrderStatus.IRONING,
    optional: true,
  },
  {
    id: 'quality_check',
    label: 'Quality check',
    description: 'Inspect cleanliness and completeness',
    orderStatus: OrderStatus.QUALITY_CHECK,
  },
  {
    id: 'ready_for_delivery',
    label: 'Ready for delivery',
    description: 'Hand off to delivery rider queue',
    orderStatus: OrderStatus.READY_FOR_DELIVERY,
  },
];

const LEGACY_STEP_MAP: Record<string, LaundryProcessingStepId> = {
  tagging: 'received',
  packaging: 'quality_check',
  weight_verification: 'received',
};

export function normalizeProcessingStepId(stepId?: string): LaundryProcessingStepId | null {
  if (!stepId) return null;
  if (LEGACY_STEP_MAP[stepId]) return LEGACY_STEP_MAP[stepId];
  if (LAUNDRY_PROCESSING_STEPS.some((s) => s.id === stepId)) {
    return stepId as LaundryProcessingStepId;
  }
  return null;
}

export function getProcessingStep(id: LaundryProcessingStepId) {
  return LAUNDRY_PROCESSING_STEPS.find((s) => s.id === id);
}

export function getNextProcessingStep(
  currentId: LaundryProcessingStepId,
  options?: { skipIroning?: boolean },
): LaundryProcessingStep | null {
  const index = LAUNDRY_PROCESSING_STEPS.findIndex((s) => s.id === currentId);
  if (index < 0) return null;

  let nextIndex = index + 1;
  if (options?.skipIroning) {
    while (
      nextIndex < LAUNDRY_PROCESSING_STEPS.length &&
      LAUNDRY_PROCESSING_STEPS[nextIndex].id === 'ironing'
    ) {
      nextIndex++;
    }
  }

  return LAUNDRY_PROCESSING_STEPS[nextIndex] ?? null;
}

/** Current step to complete based on order status (status = last completed milestone). */
export function getInitialProcessingStepForOrder(status: OrderStatus): LaundryProcessingStepId | null {
  if (status === OrderStatus.RECEIVED_AT_SHOP) return 'received';
  if (status === OrderStatus.RECEIVED) return 'sorting';
  if (status === OrderStatus.SORTING) return 'washing';
  if (status === OrderStatus.WASHING) return 'drying';
  if (status === OrderStatus.DRYING) return 'folding';
  if (status === OrderStatus.FOLDING) return 'ironing';
  if (status === OrderStatus.IRONING) return 'quality_check';
  if (status === OrderStatus.QUALITY_CHECK) return 'ready_for_delivery';
  if (status === OrderStatus.READY_FOR_DELIVERY) return null;
  return null;
}

export function getLaundryProcessingStepIndex(status: string, currentStepId?: string): number {
  const normalized = normalizeProcessingStepId(currentStepId);
  if (normalized) {
    return LAUNDRY_PROCESSING_STEPS.findIndex((s) => s.id === normalized);
  }
  const next = getInitialProcessingStepForOrder(status as OrderStatus);
  if (!next) return LAUNDRY_PROCESSING_STEPS.length - 1;
  const idx = LAUNDRY_PROCESSING_STEPS.findIndex((s) => s.id === next);
  return idx >= 0 ? idx : 0;
}

export function isProcessingComplete(currentId: LaundryProcessingStepId) {
  return currentId === 'ready_for_delivery';
}

export const LAUNDRY_PROCESSING_STATUSES: OrderStatus[] = [
  OrderStatus.RECEIVED,
  OrderStatus.SORTING,
  OrderStatus.WASHING,
  OrderStatus.DRYING,
  OrderStatus.FOLDING,
  OrderStatus.IRONING,
  OrderStatus.QUALITY_CHECK,
  OrderStatus.READY_FOR_DELIVERY,
];
