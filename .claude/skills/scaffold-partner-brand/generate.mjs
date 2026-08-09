#!/usr/bin/env node
// Scaffolds partner-brands/<slug>/ — manifest.json, ASSETS.md, and solid-color placeholder PNGs
// sized per partner-brands/README.md and DEPLOY_PLAY_STORE.md. No npm deps: PNGs are hand-encoded
// with zlib (built into Node) since these are flat single-color placeholders, not real art.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const args = parseArgs(process.argv.slice(2));

const DEFAULT_COLORS = {
  primary: '#4f46e5',
  secondary: '#06b6d4',
  accent: '#22c55e',
  background: '#ffffff',
  foreground: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  destructive: '#ef4444',
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'force') {
      out.force = true;
      continue;
    }
    out[key] = argv[++i];
  }
  return out;
}

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

if (!args.slug) fail('--slug is required (kebab-case, matches LUNARA_PARTNER_SLUG)');
if (!args.appName) fail('--appName is required');
if (!args.displayName) fail('--displayName is required (the app display name shown on-device)');
if (!args.partnerId) fail('--partnerId is required (owner User ObjectId from the Partner record)');
if (!args.easProjectId) fail('--easProjectId is required (run `LUNARA_PARTNER_SLUG=<slug> eas project:init` first)');
if (!args.iconPath) fail('--iconPath is required (path to a real 1024x1024 .png icon — placeholders are no longer generated)');
if (!args.iosBundleId) fail('--iosBundleId is required');
if (!args.androidPackage) fail('--androidPackage is required');

if (path.extname(args.iconPath).toLowerCase() !== '.png') {
  fail(`--iconPath must point to a .png file (got ${args.iconPath})`);
}
if (!fs.existsSync(args.iconPath)) {
  fail(`--iconPath file not found: ${args.iconPath}`);
}

const slug = args.slug;
const appName = args.appName;
const displayName = args.displayName;

const colors = {
  primary: args.primary || DEFAULT_COLORS.primary,
  secondary: args.secondary || DEFAULT_COLORS.secondary,
  accent: args.accent || DEFAULT_COLORS.accent,
  background: args.background || DEFAULT_COLORS.background,
  foreground: args.foreground || DEFAULT_COLORS.foreground,
  muted: args.muted || DEFAULT_COLORS.muted,
  border: args.border || DEFAULT_COLORS.border,
  destructive: args.destructive || DEFAULT_COLORS.destructive,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const outDir = path.join(repoRoot, 'partner-brands', slug);

if (fs.existsSync(outDir) && !args.force) {
  fail(`partner-brands/${slug}/ already exists. Pass --force to overwrite.`);
}
fs.mkdirSync(outDir, { recursive: true });

// ---- Minimal PNG encoder (24-bit RGB, filter type 0, single IDAT) ----

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function solidPng(width, height, hex) {
  const [r, g, b] = hexToRgb(hex);
  const rowBytes = width * 3 + 1; // +1 filter-type byte per scanline
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes;
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const o = rowStart + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function writePlaceholder(filename, width, height, hex) {
  const buf = solidPng(width, height, hex);
  fs.writeFileSync(path.join(outDir, filename), buf);
  console.log(`  ${filename}  (${width}x${height}, ${hex})`);
}

// ---- manifest.json ----

const manifest = {
  partnerId: args.partnerId,
  appName,
  slug: args.mobileSlug || `${slug}-customer`,
  iosBundleId: args.iosBundleId,
  androidPackage: args.androidPackage,
  easProjectId: args.easProjectId,
  splashBackgroundColor: colors.background,
  theme: {
    appDisplayName: displayName,
    colors,
    fonts: {
      sans: args.font || 'Inter, system-ui, sans-serif',
    },
  },
};

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// ---- ASSETS.md ----

const assetsMd = `# ${displayName} — Brand Assets

Place the following image files in this directory before running an EAS build. The versions here
were generated as **solid-color placeholders** — replace them with real design assets before
shipping to production or submitting a store listing.

| File | Size | Required |
|------|------|----------|
| \`icon.png\` | 1024×1024 px | Yes — copied in from \`--iconPath\` |
| \`splash.png\` | 1284×2778 px (or any ratio) | No — falls back to icon.png |
| \`adaptive-icon.png\` | 1024×1024 px (Android foreground layer) | No — falls back to icon.png |
| \`feature-graphic.png\` | 1024×500 px (Play Store listing only) | No — not read by app.config.js |

## Brand colours

| Token | Hex |
|-------|-----|
| Primary | \`${colors.primary}\` |
| Secondary | \`${colors.secondary}\` |
| Accent | \`${colors.accent}\` |
| Background | \`${colors.background}\` |
| Foreground | \`${colors.foreground}\` |
| Muted | \`${colors.muted}\` |
| Border | \`${colors.border}\` |
| Destructive | \`${colors.destructive}\` |

## Steps after adding real assets

1. Replace \`splash.png\`, \`adaptive-icon.png\`, and \`feature-graphic.png\` (still solid-color
   placeholders) with real design assets before shipping to production or submitting a store
   listing. \`icon.png\` was already copied in from a real file at scaffold time.
2. Upload the partner's web brand assets (logo/icon/splash/favicon) separately via admin-web —
   they live in Cloudinary against the \`Partner\` record, not this folder.
3. Run \`LUNARA_PARTNER_SLUG=${slug} eas build --profile production\` from \`apps/customer-mobile\`
   (add a \`production-${slug}\` profile to \`eas.json\` first — see
   \`partner-brands/DEPLOY_PLAY_STORE.md\`).
`;

fs.writeFileSync(path.join(outDir, 'ASSETS.md'), assetsMd);

// ---- icon (real file) + placeholder images ----

console.log(`Scaffolding partner-brands/${slug}/`);
fs.copyFileSync(args.iconPath, path.join(outDir, 'icon.png'));
console.log(`  icon.png  (copied from ${args.iconPath})`);
writePlaceholder('adaptive-icon.png', 1024, 1024, colors.primary);
writePlaceholder('splash.png', 1284, 2778, colors.background);
writePlaceholder('feature-graphic.png', 1024, 500, colors.primary);
console.log('  manifest.json');
console.log('  ASSETS.md');
console.log('\nDone. partnerId and easProjectId filled in from --partnerId/--easProjectId.');
