/**
 * One-time migration: moves every partner subscription still pointing at a legacy plan
 * (key: 'trial' | 'basic' | 'starter' | 'professional', from migrate-billing-subscriptions.ts)
 * onto the current 'default' plan (Regular Partner). Territorial Partner upgrades are done
 * manually per-partner afterward — this migration never assigns 'branded'.
 *
 * Idempotent: only touches subscriptions whose planId currently resolves to a legacy plan key.
 *
 * Run: npx ts-node src/scripts/migrate-legacy-plans-to-regular.ts
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';

const LEGACY_KEYS = ['trial', 'basic', 'starter', 'professional'];

const PlanSchema = new mongoose.Schema(
  { key: String, name: String, monthlyPrice: Number },
  { timestamps: true, collection: 'plans' },
);

const SubscriptionSchema = new mongoose.Schema(
  {
    partnerId: mongoose.Schema.Types.ObjectId,
    planId: mongoose.Schema.Types.ObjectId,
    priceSnapshot: Number,
  },
  { timestamps: true, collection: 'partner_subscriptions' },
);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const Plan = mongoose.model('Plan', PlanSchema);
  const Subscription = mongoose.model('Subscription', SubscriptionSchema);

  const defaultPlan = await Plan.findOne({ key: 'default' });
  if (!defaultPlan) throw new Error("No plan with key 'default' found — run seed-branded-plans.ts first");

  const legacyPlans = await Plan.find({ key: { $in: LEGACY_KEYS } });
  const legacyPlanIds = legacyPlans.map((p) => p._id);
  if (legacyPlanIds.length === 0) {
    console.log('No legacy plans found — nothing to migrate.');
    await mongoose.disconnect();
    return;
  }
  console.log(`Legacy plans found: ${legacyPlans.map((p) => p.get('key')).join(', ')}`);

  const result = await Subscription.updateMany(
    { planId: { $in: legacyPlanIds } },
    { $set: { planId: defaultPlan._id, priceSnapshot: defaultPlan.get('monthlyPrice') } },
  );

  console.log(`\nMigrated ${result.modifiedCount} subscription(s) to 'default' (Regular Partner, ₱${defaultPlan.get('monthlyPrice')}/mo).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
