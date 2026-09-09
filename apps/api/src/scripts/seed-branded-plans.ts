/**
 * One-time seed: creates/updates the two Plan records matching the pricing shown on the
 * partner-web signup page's "Partnership agreement" step — the ₱1,299/mo default Lunara-brand
 * plan and the ₱3,000/mo branded-app plan with its ₱5,000 one-time territory reservation fee
 * (upgradeFee). Idempotent: safe to re-run (upserts by key).
 *
 * Run: npx ts-node src/scripts/seed-branded-plans.ts
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';

const PlanSchema = new mongoose.Schema(
  {
    key: String,
    name: String,
    monthlyPrice: Number,
    trialDays: Number,
    limits: Object,
    features: Object,
    addOns: Array,
    upgradeFee: Number,
    isActive: Boolean,
    sortOrder: Number,
  },
  { timestamps: true, collection: 'plans' },
);

const SEEDS = [
  {
    key: 'default',
    name: 'Regular Partner',
    monthlyPrice: 1299,
    trialDays: 14,
    features: { customBranding: false },
    upgradeFee: 0,
    sortOrder: 10,
  },
  {
    key: 'branded',
    name: 'Territorial Partner',
    monthlyPrice: 3000,
    // Longer trial — territorial partners are waiting on their own branded mobile app to clear
    // Play Store review before they can fully operate under their own listing.
    trialDays: 30,
    features: { customBranding: true },
    upgradeFee: 5000,
    sortOrder: 11,
  },
];

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const Plan = mongoose.model('Plan', PlanSchema);

  for (const seed of SEEDS) {
    const plan = await Plan.findOneAndUpdate(
      { key: seed.key },
      {
        $set: {
          name: seed.name,
          monthlyPrice: seed.monthlyPrice,
          trialDays: seed.trialDays,
          features: seed.features,
          upgradeFee: seed.upgradeFee,
          sortOrder: seed.sortOrder,
          isActive: true,
        },
        $setOnInsert: { limits: {}, addOns: [] },
      },
      { upsert: true, new: true },
    );
    console.log(`Plan ready: ${plan!.get('key')} (₱${plan!.get('monthlyPrice')}/mo, upgradeFee ₱${plan!.get('upgradeFee')})`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
