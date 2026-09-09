/**
 * Manual backfill counterpart to seed-partner-demo.ts: clears demo data for one partner (by
 * slug) via PartnerDemoDataService — the same service the "Ready" button in partner-web calls.
 *
 * Run: npm run unseed:partner-demo --workspace=@lunara/api -- --slug=<partner-slug>
 */
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { AppModule } from '../app.module';
import { PartnerDemoDataService } from '../modules/partners/partner-demo-data.service';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run unseed script with NODE_ENV=production.');
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

    const demoDataService = app.get(PartnerDemoDataService);
    await demoDataService.clearDemoData(partner.ownerUserId.toString());
    console.log(`Cleared demo data for partner "${slug}".`);
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
