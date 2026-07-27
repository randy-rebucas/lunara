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
  express_service_24h: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#FEF3C7"/>
  <circle cx="48" cy="48" r="22" stroke="#D97706" stroke-width="3"/>
  <path d="M48 34v14l10 6" stroke="#D97706" stroke-width="3" stroke-linecap="round"/>
  <path d="M40 62h16" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
</svg>`,
  same_day_service: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#FEF3C7"/>
  <rect x="26" y="30" width="44" height="38" rx="6" stroke="#D97706" stroke-width="3"/>
  <path d="M26 42h44" stroke="#D97706" stroke-width="3"/>
  <path d="M38 24v10M58 24v10" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
  <path d="M40 52l6 6 12-12" stroke="#D97706" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  premium_stain_removal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#FFF7ED"/>
  <path d="M30 58h36l-6-28H36l-6 28Z" stroke="#EA580C" stroke-width="3" stroke-linejoin="round"/>
  <path d="M42 30h12" stroke="#EA580C" stroke-width="3"/>
  <path d="M54 42c6 4 10 10 10 16a10 10 0 1 1-20 0c0-6 4-12 10-16Z" fill="#FB923C"/>
  <path d="M64 26l4 4-4 4-4-4Z" fill="#F59E0B"/>
</svg>`,
  heavy_stain_treatment: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#FFF1F2"/>
  <path d="M28 60h40l-7-32H35l-7 32Z" stroke="#E11D48" stroke-width="3" stroke-linejoin="round"/>
  <path d="M40 28h16" stroke="#E11D48" stroke-width="3"/>
  <circle cx="48" cy="46" r="12" fill="#FB7185"/>
</svg>`,
  odor_removal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#F0FDFA"/>
  <path d="M48 24c-10 14-18 22-18 34a18 18 0 0 0 36 0c0-12-8-20-18-34Z" stroke="#0D9488" stroke-width="3"/>
  <path d="M32 30q6-4 6-10M64 30q-6-4-6-10" stroke="#14B8A6" stroke-width="3" stroke-linecap="round"/>
</svg>`,
  steam_pressing: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#EEF2FF"/>
  <path d="M26 62h44l-4-16a10 10 0 0 0-10-8H40a10 10 0 0 0-10 8l-4 16Z" stroke="#4338CA" stroke-width="3" stroke-linejoin="round"/>
  <path d="M36 30q4-6 0-12M48 30q4-6 0-12M60 30q4-6 0-12" stroke="#6366F1" stroke-width="3" stroke-linecap="round"/>
</svg>`,
  waterproofing: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#EFF6FF"/>
  <path d="M48 22c-10 14-18 24-18 36a18 18 0 0 0 36 0c0-12-8-22-18-36Z" fill="#93C5FD" stroke="#2563EB" stroke-width="3"/>
  <path d="M40 58a8 8 0 0 0 8 8" stroke="#EFF6FF" stroke-width="3" stroke-linecap="round"/>
</svg>`,
  fabric_protection: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#EFF6FF"/>
  <path d="M48 22 26 30v18c0 14 9 24 22 26 13-2 22-12 22-26V30L48 22Z" stroke="#1D4ED8" stroke-width="3" stroke-linejoin="round"/>
  <path d="M39 48l7 7 13-13" stroke="#2563EB" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  minor_repair_button: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#F1F5F9"/>
  <circle cx="48" cy="48" r="18" stroke="#475569" stroke-width="3"/>
  <circle cx="42" cy="42" r="2.5" fill="#475569"/>
  <circle cx="54" cy="42" r="2.5" fill="#475569"/>
  <circle cx="42" cy="54" r="2.5" fill="#475569"/>
  <circle cx="54" cy="54" r="2.5" fill="#475569"/>
</svg>`,
  minor_stitching: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#F1F5F9"/>
  <path d="M26 60c8-16 14-24 22-24s14 8 22 24" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
  <path d="M34 52l4-6M42 56l4-8M50 56l4-8M58 52l4-6" stroke="#64748B" stroke-width="2.5" stroke-linecap="round"/>
</svg>`,
  garment_bag_packaging: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#EEF2FF"/>
  <path d="M32 34h32v38a4 4 0 0 1-4 4H36a4 4 0 0 1-4-4V34Z" stroke="#4F46E5" stroke-width="3"/>
  <path d="M40 34a8 8 0 0 1 16 0" stroke="#4F46E5" stroke-width="3"/>
  <path d="M32 46h32" stroke="#818CF8" stroke-width="2.5" stroke-dasharray="4 4"/>
</svg>`,
  premium_hanger: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#EEF2FF"/>
  <circle cx="48" cy="28" r="4" stroke="#4F46E5" stroke-width="3"/>
  <path d="M48 32v6" stroke="#4F46E5" stroke-width="3"/>
  <path d="M48 38 24 58h48L48 38Z" stroke="#4F46E5" stroke-width="3" stroke-linejoin="round"/>
  <path d="M24 58h48" stroke="#818CF8" stroke-width="3"/>
</svg>`,
  fabric_brightening: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#FFF7ED"/>
  <path d="M48 24v10M48 62v10M24 48h10M62 48h10M31 31l7 7M58 58l7 7M65 31l-7 7M38 58l-7 7" stroke="#EA580C" stroke-width="3" stroke-linecap="round"/>
  <circle cx="48" cy="48" r="9" fill="#FB923C"/>
</svg>`,
  sanitizing_treatment: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#ECFDF5"/>
  <path d="M48 22c-10 14-18 22-18 34a18 18 0 0 0 36 0c0-12-8-20-18-34Z" stroke="#059669" stroke-width="3"/>
  <path d="M41 48l5 5 10-10" stroke="#10B981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  steam_sanitizing: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#ECFDF5"/>
  <path d="M28 62h40l-4-14a12 12 0 0 0-12-9h-8a12 12 0 0 0-12 9l-4 14Z" stroke="#059669" stroke-width="3" stroke-linejoin="round"/>
  <path d="M38 30q4-6 0-12M58 30q4-6 0-12" stroke="#10B981" stroke-width="3" stroke-linecap="round"/>
</svg>`,
  gown_preservation_packaging: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#FDF2F8"/>
  <rect x="28" y="32" width="40" height="34" rx="4" stroke="#BE185D" stroke-width="3"/>
  <path d="M28 44h40" stroke="#DB2777" stroke-width="2.5"/>
  <path d="M42 32v-4a6 6 0 0 1 12 0v4" stroke="#BE185D" stroke-width="3"/>
</svg>`,
  shoe_sole_restoration: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="20" fill="#FFF7ED"/>
  <path d="M26 60c0-8 4-10 10-12l24-8c6-2 10 0 10 8 0 8-6 12-14 12H30q-4 0-4-4Z" stroke="#C2410C" stroke-width="3" stroke-linejoin="round"/>
  <path d="M34 52h30" stroke="#EA580C" stroke-width="2.5" stroke-dasharray="3 3"/>
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
