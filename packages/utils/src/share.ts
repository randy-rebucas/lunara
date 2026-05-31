import type { Deal } from '@lunara/types';
import { formatDealDiscount } from './deals.js';

export interface SharePayload {
  title: string;
  message: string;
  url: string;
}

export type SocialPlatform = 'whatsapp' | 'facebook' | 'x';

export function formatShareText(payload: SharePayload): string {
  return `${payload.message}\n${payload.url}`;
}

export function buildAppSharePayload(appUrl: string, appName = 'Lunara'): SharePayload {
  const url = appUrl.replace(/\/$/, '');
  return {
    title: `Try ${appName} laundry`,
    message: `${appName} picks up, cleans, and delivers your laundry across Metro Manila. Book in a few taps!`,
    url,
  };
}

export function buildDealSharePayload(deal: Deal, appUrl: string, appName = 'Lunara'): SharePayload {
  const url = `${appUrl.replace(/\/$/, '')}/book`;
  const discount = formatDealDiscount(deal);
  return {
    title: `${deal.title} — ${appName}`,
    message: `${deal.title}: ${discount} with code ${deal.code}. ${deal.description ?? 'Book laundry pickup on Lunara.'}`,
    url,
  };
}

export function buildOrderSharePayload(
  orderId: string,
  statusLabel: string,
  appUrl: string,
  appName = 'Lunara',
): SharePayload {
  const url = `${appUrl.replace(/\/$/, '')}/orders/${orderId}`;
  return {
    title: `My ${appName} order`,
    message: `Tracking my laundry on ${appName} — ${statusLabel}.`,
    url,
  };
}

export function buildSocialShareUrl(platform: SocialPlatform, payload: SharePayload): string {
  const text = formatShareText(payload);
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(payload.url);
  const encodedMessage = encodeURIComponent(payload.message);

  switch (platform) {
    case 'whatsapp':
      return `https://wa.me/?text=${encodedText}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedMessage}`;
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}`;
  }
}

export const SOCIAL_SHARE_OPTIONS: { id: SocialPlatform; label: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'x', label: 'X' },
];
