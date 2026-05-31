export type WorkflowStepKey =
  | 'pickup:accept'
  | 'pickup:arrive'
  | 'pickup:verify'
  | 'pickup:collect'
  | 'pickup:photo'
  | 'pickup:receipt'
  | 'pickup:drop-at-shop'
  | 'delivery:accept'
  | 'delivery:pickup-from-shop'
  | 'delivery:out-for-delivery'
  | 'delivery:customer-received'
  | 'delivery:photo'
  | 'delivery:complete';

export interface BaseQueueItem {
  id: string;
  createdAt: string;
  retries: number;
}

export interface StatusQueueItem extends BaseQueueItem {
  kind: 'status';
  orderId: string;
  path: string;
  method: string;
  body?: string;
  stepKey: WorkflowStepKey;
}

export interface PhotoQueueItem extends BaseQueueItem {
  kind: 'photo';
  orderId: string;
  path: string;
  localUri: string;
  stepKey: WorkflowStepKey;
}

export interface GpsQueueItem extends BaseQueueItem {
  kind: 'gps';
  orderId?: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  recordedAt: string;
}

export type QueueItem = StatusQueueItem | PhotoQueueItem | GpsQueueItem;

export interface QueuedResponse {
  queued: true;
  itemId: string;
}

export function isQueuedResponse(value: unknown): value is QueuedResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'queued' in value &&
    (value as QueuedResponse).queued === true
  );
}

export const GPS_QUEUE_CAP = 500;
