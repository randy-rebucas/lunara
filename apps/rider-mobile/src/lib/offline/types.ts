export type WorkflowStepKey =
  | 'pickup:accept'
  | 'pickup:arrive'
  | 'pickup:verify'
  | 'pickup:collect-cash'
  | 'pickup:collect'
  | 'pickup:photo'
  | 'pickup:receipt'
  | 'pickup:drop-at-shop'
  | 'delivery:accept'
  | 'delivery:pickup-from-shop'
  | 'delivery:out-for-delivery'
  | 'delivery:customer-received'
  | 'delivery:photo'
  | 'delivery:collect-cash'
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

/** A single file to multipart-upload. Uploaded via expo-file-system's native uploadAsync
 * rather than fetch+FormData — RN's fetch bridges FormData file parts as base64/blob and sends
 * the body chunked with no Content-Length, which the ngrok free-tier tunnel used for local dev
 * intermittently resets mid-upload ("Network request failed") even though plain JSON requests
 * over the same tunnel succeed. uploadAsync streams the file natively with a known length. */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
  fieldName: string;
}

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
