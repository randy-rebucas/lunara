/**
 * Manual backfill: seeds demo data for one already-onboarded partner (by slug) via
 * PartnerDemoDataService — the same service the onboarding flow now calls automatically for
 * new signups. Use this for partners who onboarded before that hook existed.
 *
 * Run: npm run seed:partner-demo --workspace=@lunara/api -- --slug=<partner-slug>
 * Undo: npm run unseed:partner-demo --workspace=@lunara/api -- --slug=<partner-slug>
 */
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { AppModule } from '../app.module';
import { PartnerDemoDataService } from '../modules/partners/partner-demo-data.service';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run seed script with NODE_ENV=production — this would overwrite live data.');
}

const slugArg = process.argv.find((a) => a.startsWith('--slug='));
const slugValue = slugArg?.slice('--slug='.length);
if (!slugValue) {
  throw new Error('Missing required --slug=<partner-slug> argument.');
}
const slug: string = slugValue;

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const connection = app.get<Connection>(getConnectionToken());
    const db = connection.db!;
    const partner = await db.collection('partners').findOne({ slug });
    if (!partner) {
      throw new Error(`No partner found with slug "${slug}".`);
    }
    const branch = await db.collection('branches').findOne({ partnerUserId: partner.ownerUserId });
    if (!branch) {
      throw new Error(`No branch found for partner "${slug}".`);
    }

    const demoDataService = app.get(PartnerDemoDataService);
    await demoDataService.seedDemoData(partner.ownerUserId.toString(), branch._id.toString());
    console.log(`Seeded demo data for partner "${slug}".`);
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
