/**
 * Seed the customer-mobile-derived screen set into a partner's draft app config.
 * Run: npm run seed:screens --workspace=@lunara/api -- <partnerId> [slug] [--publish]
 *
 * --publish also republishes the draft as a new published version right after seeding —
 * use it for the public-preset partner (e.g. `public-preset base --publish`) so re-running
 * the seed keeps the publicly-fetched preset in sync without a separate manual publish step.
 */
import mongoose from 'mongoose';
import type { BrandTheme } from '@lunara/types';
import { reseedAppConfigScreens } from '../modules/app-configs/app-configs.seed';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';

const DEFAULT_THEME: BrandTheme = {
  primary: '#2563eb',
  secondary: '#1e40af',
  accent: '#f59e0b',
  background: '#ffffff',
  foreground: '#0f172a',
  muted: '#f1f5f9',
  border: '#e2e8f0',
  destructive: '#ef4444',
};

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--publish');
  const shouldPublish = process.argv.includes('--publish');
  const partnerId = args[0];
  const slug = args[1] ?? 'default';

  if (!partnerId) {
    console.error(
      'Usage: npm run seed:screens --workspace=@lunara/api -- <partnerId> [slug] [--publish]',
    );
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;
  const collection = db.collection('partner_app_configs');

  console.log(`Reseeding app config screens for partner ${partnerId} (slug: ${slug})…`);
  await reseedAppConfigScreens(collection, { partnerId, slug, theme: DEFAULT_THEME });

  if (shouldPublish) {
    const draft = await collection.findOne({ partnerId, status: 'draft' });
    if (!draft) throw new Error('Seed did not produce a draft to publish');

    const latestPublished = await collection
      .find({ partnerId, status: 'published' })
      .sort({ version: -1 })
      .limit(1)
      .next();
    const nextVersion = (latestPublished?.version ?? 0) + 1;
    const { _id, ...rest } = draft;

    await collection.updateOne(
      { partnerId, slug, status: 'published', version: nextVersion },
      { $set: { ...rest, status: 'published', version: nextVersion } },
      { upsert: true },
    );
    console.log(`Published ${partnerId}/${slug} as version ${nextVersion}.`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
