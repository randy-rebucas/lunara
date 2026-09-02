import { resolveApiV1BaseUrl } from '@lunara/utils';
import type { PartnerAppConfig } from '@lunara/types';

export async function fetchPublishedAppConfig(slug: string): Promise<PartnerAppConfig> {
  const baseUrl = resolveApiV1BaseUrl(process.env.EXPO_PUBLIC_API_URL);
  const response = await fetch(`${baseUrl}/public/app-configs/${encodeURIComponent(slug)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch app config for "${slug}": ${response.status}`);
  }
  const body = (await response.json()) as { success: boolean; data: PartnerAppConfig };
  return body.data;
}
