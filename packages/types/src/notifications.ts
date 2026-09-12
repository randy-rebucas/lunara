/** Shared shape for the in-app notification list surfaced across client apps (partner-web's
 * PortalNotification, rider-mobile's RiderNotification, partner-mobile's PartnerNotification all
 * mirror this) — the category/type strings themselves stay app-specific since each role's backend
 * module (partner-notification.constants.ts, rider-notification.constants.ts) defines its own
 * relevant-event set, but the envelope shape is common. */
export interface AppNotification {
  _id: string;
  title: string;
  body: string;
  read: boolean;
  category?: string;
  createdAt: string;
  data?: {
    category?: string;
    type?: string;
    orderId?: string;
    event?: string;
    status?: string;
    branchName?: string;
  };
}
