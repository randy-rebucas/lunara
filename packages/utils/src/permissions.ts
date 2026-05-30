import { UserRole } from '@lunara/types';

export const PERMISSIONS = {
  // Orders
  'orders:read': 'View orders',
  'orders:create': 'Create orders',
  'orders:update': 'Update orders',
  'orders:cancel': 'Cancel orders',
  'orders:assign-rider': 'Assign riders to orders',
  // Users
  'users:read': 'View users',
  'users:manage': 'Manage users',
  // Partners
  'partners:read': 'View partners',
  'partners:manage': 'Manage partners',
  // Finance
  'payments:read': 'View payments',
  'payments:refund': 'Process refunds',
  'reports:read': 'View reports',
  // System
  'settings:manage': 'Manage system settings',
  'cms:manage': 'Manage CMS content',
  'audit:read': 'View audit logs',
} as const;

export type Permission = keyof typeof PERMISSIONS;

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.CUSTOMER]: ['orders:read', 'orders:create', 'orders:cancel'],
  [UserRole.RIDER]: ['orders:read', 'orders:update'],
  [UserRole.STAFF]: ['orders:read', 'orders:update'],
  [UserRole.PARTNER]: [
    'orders:read',
    'orders:update',
    'orders:assign-rider',
    'users:read',
    'reports:read',
  ],
  [UserRole.ADMIN]: Object.keys(PERMISSIONS) as Permission[],
};

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}
