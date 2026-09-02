#!/usr/bin/env node
// Automates the EAS setup a new partner brand needs before/alongside generate.mjs:
//   1. `eas project:init` to create the partner's own EAS project (unless --easProjectId given)
//   2. add `preview-<slug>` / `production-<slug>` profiles to apps/customer-mobile/eas.json
//   3. `eas env:create` for EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WEBSITE_URL on that project
//
// Use --dry-run to print what would run/change without touching eas.json or calling the EAS CLI.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'dry-run') {
      out.dryRun = true;
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
if (!args.apiUrl) fail('--apiUrl is required (EXPO_PUBLIC_API_URL for this partner)');
if (!args.websiteUrl) fail('--websiteUrl is required (EXPO_PUBLIC_WEBSITE_URL for this partner)');

const slug = args.slug;
const dryRun = Boolean(args.dryRun);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const mobileDir = path.join(repoRoot, 'apps', 'customer-mobile');
const easJsonPath = path.join(mobileDir, 'eas.json');

function run(cmd, cmdArgs, opts = {}) {
  const display = [cmd, ...cmdArgs].join(' ');
  if (dryRun) {
    console.log(`  [dry-run] would run: ${display}`);
    return '';
  }
  console.log(`  running: ${display}`);
  return execFileSync(cmd, cmdArgs, {
    cwd: mobileDir,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: process.platform === 'win32',
    ...opts,
  });
}

// ---- 1. eas project:init (unless an id was already supplied) ----

let easProjectId = args.easProjectId;

if (!easProjectId) {
  console.log(`\n1. Creating EAS project for ${slug}...`);
  const output = run('eas', ['project:init', '--non-interactive'], {
    env: { ...process.env, LUNARA_PARTNER_SLUG: slug },
  });
  if (!dryRun) {
    const match = output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!match) {
      fail(
        `Could not parse an EAS project id out of \`eas project:init\` output. Run it manually ` +
          `and pass the resulting id via --easProjectId.\nOutput was:\n${output}`
      );
    }
    easProjectId = match[0];
    console.log(`  easProjectId: ${easProjectId}`);
  } else {
    easProjectId = '<eas-project-id>';
  }
} else {
  console.log(`\n1. Using supplied --easProjectId ${easProjectId} (skipping eas project:init)`);
}

// ---- 2. patch eas.json ----

console.log(`\n2. Adding preview-${slug} / production-${slug} profiles to eas.json...`);

const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));

const previewKey = `preview-${slug}`;
const productionKey = `production-${slug}`;

if (easJson.build[previewKey] && easJson.build[productionKey]) {
  console.log(`  ${previewKey} / ${productionKey} already exist in eas.json — skipping (this is`);
  console.log(`  expected if you're re-running after generate.mjs to pick up step 3).`);
} else {
  easJson.build[previewKey] = {
    extends: 'preview',
    env: { LUNARA_PARTNER_SLUG: slug },
  };
  easJson.build[productionKey] = {
    extends: 'production',
    env: { LUNARA_PARTNER_SLUG: slug },
  };

  if (dryRun) {
    console.log(`  [dry-run] would add to eas.json:`);
    console.log(
      JSON.stringify({ [previewKey]: easJson.build[previewKey], [productionKey]: easJson.build[productionKey] }, null, 2)
    );
  } else {
    fs.writeFileSync(easJsonPath, JSON.stringify(easJson, null, 2) + '\n');
    console.log(`  wrote ${path.relative(repoRoot, easJsonPath)}`);
  }
}

// ---- 2b. bail out before hitting `eas env:create` if the manifest isn't scaffolded yet ----
// `eas env:create` shells out to `expo config`, which evaluates app.config.js — that throws if
// partner-brands/<slug>/manifest.json doesn't exist. Run generate.mjs first, then re-run this
// script (steps 1-2 above are now no-ops) to actually create the env vars.

const manifestPath = path.join(repoRoot, 'partner-brands', slug, 'manifest.json');
if (!fs.existsSync(manifestPath) && !dryRun) {
  console.log(
    `\npartner-brands/${slug}/manifest.json doesn't exist yet, so \`eas env:create\` would fail ` +
      `(it shells out to \`expo config\`, which requires the manifest). Run generate.mjs first, ` +
      `then re-run this script to set the env vars.\n` +
      `easProjectId=${easProjectId}`
  );
  process.exit(0);
}

// ---- 3. eas env:create for the two EXPO_PUBLIC_* vars ----

console.log(`\n3. Setting EAS project env vars...`);

for (const [name, value] of [
  ['EXPO_PUBLIC_API_URL', args.apiUrl],
  ['EXPO_PUBLIC_WEBSITE_URL', args.websiteUrl],
]) {
  run(
    'eas',
    [
      'env:create',
      '--scope', 'project',
      '--name', name,
      '--value', value,
      '--environment', 'production',
      '--visibility', 'plaintext',
      '--non-interactive',
    ],
    { env: { ...process.env, LUNARA_PARTNER_SLUG: slug } }
  );
}

console.log(
  `\nDone.${dryRun ? ' (dry run — nothing was changed)' : ''} easProjectId=${easProjectId}\n` +
    `Next: run generate.mjs with --easProjectId ${easProjectId} to scaffold partner-brands/${slug}/.`
);
