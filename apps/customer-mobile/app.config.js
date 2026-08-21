const fs = require('fs');
const path = require('path');
const { loadProjectEnv } = require('@expo/env');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

loadProjectEnv(monorepoRoot);

const appJson = require('./app.json').expo;
const websiteUrl = process.env.EXPO_PUBLIC_WEBSITE_URL?.trim() || 'https://lunara.app';

// When set, builds a white-labeled partner app instead of the default Lunara app —
// own bundle id/name/icon/splash/EAS project, sourced from partner-brands/<slug>/manifest.json.
const partnerSlug = process.env.LUNARA_PARTNER_SLUG?.trim();
const defaultBrandDir = path.join(monorepoRoot, 'packages/brand/assets');
const partnerBrandDir = partnerSlug
  ? path.join(monorepoRoot, 'partner-brands', partnerSlug)
  : undefined;

let manifest;
if (partnerSlug) {
  const manifestPath = path.join(partnerBrandDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `LUNARA_PARTNER_SLUG=${partnerSlug} but partner-brands/${partnerSlug}/manifest.json was not found.`,
    );
  }
  manifest = require(manifestPath);
}

const brandDir = partnerSlug ? partnerBrandDir : defaultBrandDir;
const icon = path.join(brandDir, 'icon.png');
const splash = fs.existsSync(path.join(brandDir, 'splash.png'))
  ? path.join(brandDir, 'splash.png')
  : icon;
const adaptiveIcon = fs.existsSync(path.join(brandDir, 'adaptive-icon.png'))
  ? path.join(brandDir, 'adaptive-icon.png')
  : icon;

// In-app <Image> logos (login screen, home banner, BrandMark) can't `require()` a path that only
// resolves at build time — Metro needs a literal, always-present specifier. So mirror whichever
// icon is active (partner or default) into a fixed filename every config eval; JS just requires
// that one file and gets whichever brand was active for this build.
const generatedIconPath = path.join(projectRoot, 'assets', 'generated-brand-icon.png');
fs.copyFileSync(icon, generatedIconPath);

// Optional partner-supplied typeface: partner-brands/<slug>/fonts/Regular.{ttf,otf} (+ optional Bold).
// When absent (the default case), the app keeps using the OS system font — no behavior change.
function findFont(dir, baseName) {
  for (const ext of ['ttf', 'otf']) {
    const fontPath = path.join(dir, `${baseName}.${ext}`);
    if (fs.existsSync(fontPath)) return fontPath;
  }
  return undefined;
}

const fontsDir = partnerBrandDir ? path.join(partnerBrandDir, 'fonts') : undefined;
const regularFontPath = fontsDir ? findFont(fontsDir, 'Regular') : undefined;
const boldFontPath = fontsDir ? findFont(fontsDir, 'Bold') : undefined;
const partnerFontFamily = regularFontPath
  ? { regular: 'PartnerSans', bold: boldFontPath ? 'PartnerSans-Bold' : 'PartnerSans' }
  : null;

// The display name customers actually see — partner's app name for a white-labeled build,
// else the default Lunara app name.
const brandDisplayName = manifest?.theme?.appDisplayName ?? manifest?.appName ?? appJson.name;

// Native permission-prompt strings (location/photo/camera) are baked into Info.plist /
// AndroidManifest at prebuild time via these plugin configs, so they can't be swapped at JS
// runtime like the in-app copy — rewrite the "Lunara" wording here instead, at config-eval time.
const brandedPlugins = JSON.parse(
  JSON.stringify(appJson.plugins ?? []).split('Lunara').join(brandDisplayName),
);

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  ...appJson,
  name: manifest?.appName ?? appJson.name,
  slug: manifest?.slug ?? appJson.slug,
  extra: {
    ...appJson.extra,
    eas: {
      ...appJson.extra?.eas,
      projectId: manifest?.easProjectId ?? appJson.extra.eas.projectId,
    },
    privacyUrl: `${websiteUrl}/privacy`,
    termsUrl: `${websiteUrl}/terms`,
    partnerSlug: partnerSlug ?? null,
    partnerId: manifest?.partnerId ?? null,
    partnerTheme: manifest?.theme ?? null,
    partnerFontFamily,
  },
  plugins: [
    ...brandedPlugins,
    [
      'expo-splash-screen',
      {
        image: splash,
        resizeMode: 'contain',
        backgroundColor: manifest?.splashBackgroundColor ?? '#ffffff',
      },
    ],
    ...(regularFontPath
      ? [
          [
            'expo-font',
            {
              fonts: [regularFontPath, ...(boldFontPath ? [boldFontPath] : [])],
            },
          ],
        ]
      : []),
  ],
  icon,
  android: {
    ...appJson.android,
    package: manifest?.androidPackage ?? appJson.android.package,
    adaptiveIcon: {
      foregroundImage: adaptiveIcon,
      backgroundColor: manifest?.splashBackgroundColor ?? '#ffffff',
    },
  },
  ios: {
    ...appJson.ios,
    bundleIdentifier: manifest?.iosBundleId ?? appJson.ios.bundleIdentifier,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
};
