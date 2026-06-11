/** Public customer web URL used as PayMongo return origin from mobile apps. */
export function getCustomerClientOrigin(): string {
  const url = process.env.EXPO_PUBLIC_WEBSITE_URL?.trim() || 'https://lunara.app';
  return url.replace(/\/$/, '');
}
