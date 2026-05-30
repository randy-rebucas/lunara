/** Lunara managed network — who can do what. */
export const PLATFORM_USER_ROLES = {
  customer: {
    id: 'customer',
    label: 'Customer',
    can: [
      'Book laundry services',
      'Choose service type, pickup schedule, address, payment method',
    ],
    cannot: ['Choose laundry shop', 'Assign riders', 'See other customers’ orders'],
  },
  admin: {
    id: 'admin',
    label: 'Admin dispatcher',
    subtitle: 'Logistics control tower',
    can: [
      'Review incoming orders',
      'Assign laundry shop (branch)',
      'Assign pickup and delivery riders',
      'Monitor SLA',
      'Monitor order progress',
      'Resolve conflicts (support tickets)',
      'Trigger rider pickup search when needed',
    ],
    cannot: ['Process laundry at the shop', 'Accept rider tasks as a rider'],
  },
  partner: {
    id: 'partner',
    label: 'Laundry partner / franchise',
    can: [
      'Receive admin-assigned orders only',
      'Accept order at the shop',
      'Process laundry and update status',
      'Request pickup or delivery rider dispatch',
      'Assign staff to orders',
    ],
    cannot: ['Compete for or browse unassigned marketplace orders', 'Choose customers'],
  },
  staff: {
    id: 'staff',
    label: 'Shop staff',
    can: [
      'Work assigned processing queue',
      'Accept processing jobs',
      'Advance laundry steps and upload step photos',
    ],
    cannot: ['Accept franchise orders on behalf of the shop (partner only)', 'Dispatch riders'],
  },
  rider: {
    id: 'rider',
    label: 'Rider',
    can: [
      'Accept pickup or delivery tasks (when offered or admin-assigned)',
      'Pickup laundry from customer',
      'Deliver to shop',
      'Deliver to customer',
      'Upload proof photos',
    ],
    cannot: ['Choose orders outside assigned/offered tasks', 'Assign shops'],
  },
} as const;

export type PlatformRoleId = keyof typeof PLATFORM_USER_ROLES;
