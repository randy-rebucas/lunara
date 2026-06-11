import { existsSync, mkdirSync, writeFileSync } from 'fs';
import {
  CATALOG_ADDON_UPLOAD_DIR,
  catalogAddonPublicPath,
} from '../../common/uploads/upload-paths';

const ADDON_SVGS: Record<string, string> = {
  fabric_softener: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#EEF2FF"/>
  <path d="M38 24h20l4 12v36a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6V36l4-12Z" stroke="#4F46E5" stroke-width="3"/>
  <path d="M34 36h28" stroke="#4F46E5" stroke-width="3"/>
  <circle cx="48" cy="54" r="8" fill="#818CF8"/>
</svg>`,
  stain_treatment: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#FFF7ED"/>
  <path d="M30 58h36l-6-28H36l-6 28Z" stroke="#EA580C" stroke-width="3" stroke-linejoin="round"/>
  <path d="M42 30h12" stroke="#EA580C" stroke-width="3"/>
  <path d="M54 42c6 4 10 10 10 16a10 10 0 1 1-20 0c0-6 4-12 10-16Z" fill="#FB923C"/>
</svg>`,
  eco_wash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#ECFDF5"/>
  <path d="M48 22c-10 14-18 22-18 34a18 18 0 0 0 36 0c0-12-8-20-18-34Z" stroke="#059669" stroke-width="3"/>
  <path d="M48 38v24M40 50h16" stroke="#10B981" stroke-width="3" stroke-linecap="round"/>
</svg>`,
  express_delivery: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#FEF3C7"/>
  <circle cx="48" cy="48" r="22" stroke="#D97706" stroke-width="3"/>
  <path d="M48 34v18l12 8" stroke="#D97706" stroke-width="3" stroke-linecap="round"/>
  <path d="M62 28 72 22v14" stroke="#F59E0B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
};

export function writeCatalogAddonImages(slugs: string[]) {
  if (!existsSync(CATALOG_ADDON_UPLOAD_DIR)) {
    mkdirSync(CATALOG_ADDON_UPLOAD_DIR, { recursive: true });
  }

  for (const slug of slugs) {
    const svg = ADDON_SVGS[slug];
    if (!svg) continue;
    writeFileSync(`${CATALOG_ADDON_UPLOAD_DIR}/${slug}.svg`, svg, 'utf8');
  }
}

export function defaultAddonImageUrl(slug: string) {
  return ADDON_SVGS[slug] ? catalogAddonPublicPath(`${slug}.svg`) : undefined;
}
