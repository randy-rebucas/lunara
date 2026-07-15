import type { MetadataRoute } from 'next';
import brandIcon from '@lunara/brand/icon';
import { appConfig } from '@lunara/config';
import { DEFAULT_DESCRIPTION } from '../lib/seo';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${appConfig.name} — Laundry pickup & delivery`,
    short_name: appConfig.name,
    description: DEFAULT_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    icons: [
      {
        src: brandIcon.src,
        sizes: `${brandIcon.width}x${brandIcon.height}`,
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
