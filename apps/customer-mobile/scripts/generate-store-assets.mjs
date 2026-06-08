/**
 * Generate App Store / Play Store screenshot templates at required dimensions.
 *
 * Usage:
 *   node scripts/generate-store-assets.mjs
 *   node scripts/generate-store-assets.mjs --captures ./captures
 *
 * With --captures, place PNGs named 01-home.png … 08-profile.png in the folder;
 * they are composited into the phone frame area.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const outRoot = path.join(appRoot, 'store-assets');
const iconPath = path.resolve(appRoot, '../../packages/brand/assets/icon.png');

const FRAMES = [
  { id: '01-home', screen: 'Home', caption: 'Book laundry in minutes' },
  { id: '02-book', screen: 'Book laundry', caption: 'Door-to-door pickup & delivery' },
  { id: '03-checkout', screen: 'Checkout', caption: 'Pay your way — GCash, card, wallet' },
  { id: '04-track', screen: 'Track order', caption: 'Track every step in real time' },
  { id: '05-orders', screen: 'Orders', caption: 'All your orders in one place' },
  { id: '06-wallet', screen: 'Wallet', caption: 'Top up and pay from your wallet' },
  { id: '07-notifications', screen: 'Notifications', caption: 'Stay updated on every order' },
  { id: '08-profile', screen: 'Profile', caption: 'Manage addresses and account' },
];

const BRAND = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  secondary: '#06B6D4',
  white: '#FFFFFF',
  muted: '#E2E8F0',
  text: '#0F172A',
};

const SIZES = {
  ios: { width: 1290, height: 2796, label: '6.7-inch' },
  android: { width: 1080, height: 1920, label: 'phone-9-16' },
};

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function phoneLayout(width, height) {
  const padX = Math.round(width * 0.08);
  const headerH = Math.round(height * 0.11);
  const captionH = Math.round(height * 0.1);
  const phoneY = headerH + Math.round(height * 0.02);
  const phoneH = height - phoneY - captionH - Math.round(height * 0.04);
  const phoneW = width - padX * 2;
  const radius = Math.round(width * 0.06);
  return { padX, headerH, captionH, phoneX: padX, phoneY, phoneW, phoneH, radius };
}

function buildScreenshotSvg({ width, height, frame, platform }) {
  const { padX, headerH, phoneX, phoneY, phoneW, phoneH, radius, captionH } = phoneLayout(
    width,
    height,
  );
  const titleSize = Math.round(width * 0.052);
  const subSize = Math.round(width * 0.028);
  const captionSize = Math.round(width * 0.042);
  const badgeSize = Math.round(width * 0.022);
  const placeholderSize = Math.round(width * 0.032);

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND.primary}"/>
      <stop offset="100%" stop-color="${BRAND.primaryDark}"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="0" y="0" width="${width}" height="${Math.round(height * 0.35)}" fill="url(#shine)"/>

  <text x="${padX}" y="${Math.round(headerH * 0.55)}" fill="${BRAND.white}" font-family="system-ui,Segoe UI,sans-serif" font-size="${titleSize}" font-weight="700">Lunara</text>
  <text x="${padX}" y="${Math.round(headerH * 0.82)}" fill="${BRAND.muted}" font-family="system-ui,Segoe UI,sans-serif" font-size="${subSize}">${escapeXml(frame.screen)} · ${platform}</text>

  <rect x="${phoneX}" y="${phoneY}" width="${phoneW}" height="${phoneH}" rx="${radius}" fill="${BRAND.white}" stroke="#CBD5E1" stroke-width="3"/>
  <rect x="${phoneX + 12}" y="${phoneY + 12}" width="${phoneW - 24}" height="${phoneH - 24}" rx="${Math.max(radius - 8, 12)}" fill="#F8FAFC"/>
  <text x="${width / 2}" y="${phoneY + phoneH / 2 - placeholderSize}" text-anchor="middle" fill="#94A3B8" font-family="system-ui,Segoe UI,sans-serif" font-size="${placeholderSize}" font-weight="600">App screenshot</text>
  <text x="${width / 2}" y="${phoneY + phoneH / 2 + placeholderSize}" text-anchor="middle" fill="#64748B" font-family="system-ui,Segoe UI,sans-serif" font-size="${badgeSize}">${escapeXml(frame.id)}.png</text>

  <rect x="${padX}" y="${height - captionH - Math.round(height * 0.03)}" width="${width - padX * 2}" height="${captionH}" rx="${Math.round(captionH / 2)}" fill="rgba(255,255,255,0.14)"/>
  <text x="${width / 2}" y="${height - Math.round(height * 0.055)}" text-anchor="middle" fill="${BRAND.white}" font-family="system-ui,Segoe UI,sans-serif" font-size="${captionSize}" font-weight="700">${escapeXml(frame.caption)}</text>
</svg>`;
}

function buildFeatureGraphicSvg() {
  const width = 1024;
  const height = 500;
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND.primary}"/>
      <stop offset="100%" stop-color="${BRAND.primaryDark}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <circle cx="860" cy="120" r="180" fill="${BRAND.secondary}" opacity="0.25"/>
  <circle cx="920" cy="380" r="140" fill="${BRAND.white}" opacity="0.08"/>
  <text x="72" y="210" fill="${BRAND.white}" font-family="system-ui,Segoe UI,sans-serif" font-size="72" font-weight="800">Lunara</text>
  <text x="72" y="280" fill="${BRAND.muted}" font-family="system-ui,Segoe UI,sans-serif" font-size="36" font-weight="500">Laundry made simple</text>
  <text x="72" y="360" fill="${BRAND.white}" font-family="system-ui,Segoe UI,sans-serif" font-size="28" font-weight="600">Book · Track · Pay · Delivered</text>
</svg>`;
}

async function renderSvgToPng(svg, outPath) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outPath);
}

async function compositeCapture(basePath, capturePath, layout) {
  if (!fs.existsSync(capturePath)) return basePath;

  const meta = await sharp(basePath).metadata();
  const { phoneX, phoneY, phoneW, phoneH, radius } = layout(meta.width, meta.height);

  const innerPad = Math.round(meta.width * 0.012);
  const targetW = phoneW - innerPad * 2;
  const targetH = phoneH - innerPad * 2;

  const resized = await sharp(capturePath)
    .resize(targetW, targetH, { fit: 'cover', position: 'top' })
    .png()
    .toBuffer();

  const mask = Buffer.from(
    `<svg width="${targetW}" height="${targetH}"><rect x="0" y="0" width="${targetW}" height="${targetH}" rx="${Math.max(radius - 12, 8)}" fill="white"/></svg>`,
  );

  const clipped = await sharp(resized)
    .composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }])
    .png()
    .toBuffer();

  const out = path.join(path.dirname(basePath), path.basename(basePath, '.png') + '-with-capture.png');
  await sharp(basePath)
    .composite([{ input: clipped, left: phoneX + innerPad, top: phoneY + innerPad }])
    .png()
    .toFile(out);

  return out;
}

async function exportPlayIcon() {
  if (!fs.existsSync(iconPath)) return;
  const out = path.join(outRoot, 'android', 'hi-res-icon-512.png');
  await sharp(iconPath).resize(512, 512).png().toFile(out);
}

async function generatePlatform(platform, capturesDir) {
  const { width, height, label } = SIZES[platform];
  const dir = path.join(outRoot, platform);
  fs.mkdirSync(dir, { recursive: true });

  const layout = (w, h) => phoneLayout(w, h);
  const manifest = [];

  for (const frame of FRAMES) {
    const filename = `${frame.id}-${frame.screen.toLowerCase().replace(/\s+/g, '-')}-${width}x${height}.png`;
    const outPath = path.join(dir, filename);
    const svg = buildScreenshotSvg({ width, height, frame, platform: label });
    await renderSvgToPng(svg, outPath);

    let finalPath = outPath;
    if (capturesDir) {
      const capturePath = path.join(capturesDir, `${frame.id}.png`);
      finalPath = await compositeCapture(outPath, capturePath, layout);
    }

    manifest.push({ frame: frame.id, file: path.relative(outRoot, finalPath), size: `${width}×${height}` });
  }

  return manifest;
}

async function main() {
  const capturesArg = process.argv.indexOf('--captures');
  const capturesDir =
    capturesArg !== -1 ? path.resolve(process.cwd(), process.argv[capturesArg + 1]) : null;

  fs.mkdirSync(path.join(outRoot, 'android'), { recursive: true });

  const featurePath = path.join(outRoot, 'android', 'feature-graphic-1024x500.png');
  await renderSvgToPng(buildFeatureGraphicSvg(), featurePath);
  await exportPlayIcon();

  const ios = await generatePlatform('ios', capturesDir);
  const android = await generatePlatform('android', capturesDir);

  const readme = `# Lunara store assets

Generated by \`node scripts/generate-store-assets.mjs\`.

## iOS (App Store Connect) — 1290×2796

${ios.map((i) => `- \`${i.file}\` — ${i.size}`).join('\n')}

Upload from \`ios/\` to **6.7" Display** in App Store Connect.

## Android (Google Play) — 1080×1920

${android.map((i) => `- \`${i.file}\` — ${i.size}`).join('\n')}

Upload from \`android/\` as phone screenshots.

## Other

- \`android/feature-graphic-1024x500.png\` — Play Store feature graphic
- \`android/hi-res-icon-512.png\` — Play Store hi-res icon (if needed)

## Replace placeholders with real captures

1. Take app screenshots on device or simulator.
2. Save as \`01-home.png\` … \`08-profile.png\` in a folder.
3. Run:

\`\`\`bash
node scripts/generate-store-assets.mjs --captures ./captures
\`\`\`

Outputs \`*-with-capture.png\` composited into each frame.
`;

  fs.writeFileSync(path.join(outRoot, 'README.md'), readme);
  console.log(`Store assets written to ${outRoot}`);
  console.log(`  iOS:     ${ios.length} files @ 1290×2796`);
  console.log(`  Android: ${android.length} files @ 1080×1920`);
  console.log(`  Feature: android/feature-graphic-1024x500.png`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
