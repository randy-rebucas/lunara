import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Authenticated app surface — nothing crawlable behind these.
        disallow: [
          '/dashboard',
          '/book',
          '/orders',
          '/checkout/',
          '/wallet',
          '/rewards',
          '/refunds',
          '/support',
          '/notifications',
          '/profile',
          '/settings',
          '/onboarding/',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
