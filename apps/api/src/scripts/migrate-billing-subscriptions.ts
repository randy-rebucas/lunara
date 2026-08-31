/**
 * One-time migration: backfill the new billing.Plan / billing.Subscription collections
 * from the deprecated User.subscriptionPlan / planPrice / planRenewsAt / trialEndsAt fields.
 *
 * Does NOT delete or modify the User fields — that's a separate cleanup once this is
 * verified in production. Idempotent: safe to re-run (upserts by key/partnerId).
 *
 * Run: npx ts-node src/scripts/migrate-billing-subscriptions.ts
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';

interface UserDoc {
  _id: mongoose.Types.ObjectId;
  role: string;
  subscriptionPlan?: 'trial' | 'basic' | 'starter' | 'professional';
  planPrice?: number;
  planRenewsAt?: Date;
  trialEndsAt?: Date;
}

const UserSchema = new mongoose.Schema(
  {
    role: String,
    subscriptionPlan: String,
    planPrice: Number,
    planRenewsAt: Date,
    trialEndsAt: Date,
  },
  { collection: 'users' },
);

const PlanSchema = new mongoose.Schema(
  {
    key: String,
    name: String,
    monthlyPrice: Number,
    trialDays: Number,
    limits: Object,
    features: Object,
    addOns: Array,
    isActive: Boolean,
    sortOrder: Number,
  },
  { timestamps: true, collection: 'plans' },
);

const SubscriptionSchema = new mongoose.Schema(
  {
    partnerId: mongoose.Schema.Types.ObjectId,
    planId: mongoose.Schema.Types.ObjectId,
    status: String,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    trialEndsAt: Date,
    cancelAtPeriodEnd: Boolean,
    priceSnapshot: Number,
    provider: String,
  },
  { timestamps: true, collection: 'partner_subscriptions' },
);

const DEFAULT_PLAN_SEEDS = [
  { key: 'trial', name: 'Trial', monthlyPrice: 0, trialDays: 30, sortOrder: 0 },
  { key: 'basic', name: 'Basic', monthlyPrice: 799, trialDays: 0, sortOrder: 1 },
  { key: 'starter', name: 'Starter', monthlyPrice: 1299, trialDays: 0, sortOrder: 2 },
  { key: 'professional', name: 'Professional', monthlyPrice: 2499, trialDays: 0, sortOrder: 3 },
];

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const User = mongoose.model<UserDoc>('User', UserSchema);
  const Plan = mongoose.model('Plan', PlanSchema);
  const Subscription = mongoose.model('Subscription', SubscriptionSchema);

  // 1. Seed default plans, using the highest observed planPrice per key if partners already
  // pay something other than the default (idempotent upsert on `key`).
  const observedPrices = await User.aggregate<{ _id: string; maxPrice: number }>([
    { $match: { subscriptionPlan: { $ne: null }, planPrice: { $gt: 0 } } },
    { $group: { _id: '$subscriptionPlan', maxPrice: { $max: '$planPrice' } } },
  ]);
  const priceByKey = new Map(observedPrices.map((r) => [r._id, r.maxPrice]));

  const planIdByKey = new Map<string, mongoose.Types.ObjectId>();
  for (const seed of DEFAULT_PLAN_SEEDS) {
    const monthlyPrice = priceByKey.get(seed.key) ?? seed.monthlyPrice;
    const plan = await Plan.findOneAndUpdate(
      { key: seed.key },
      { $setOnInsert: { ...seed, monthlyPrice, limits: {}, features: {}, addOns: [], isActive: true } },
      { upsert: true, new: true },
    );
    planIdByKey.set(seed.key, plan!._id as mongoose.Types.ObjectId);
    console.log(`Plan ready: ${seed.key} (₱${monthlyPrice}/mo)`);
  }

  // 2. Backfill a Subscription per partner-role User that has a subscriptionPlan set.
  const partnerUsers = await User.find({ role: 'partner', subscriptionPlan: { $ne: null } }).lean();
  console.log(`Found ${partnerUsers.length} partner users with a subscriptionPlan set.`);

  let created = 0;
  let errors = 0;

  for (const user of partnerUsers) {
    try {
      const key = user.subscriptionPlan ?? 'trial';
      const planId = planIdByKey.get(key) ?? planIdByKey.get('trial')!;
      const now = new Date();
      const isTrial = key === 'trial';
      const rawPeriodEnd = isTrial ? user.trialEndsAt : user.planRenewsAt;
      // .lean() doesn't always cast schema-declared Date fields depending on how the raw doc
      // was originally written (e.g. a prior migration/seed script storing a string) — coerce
      // explicitly rather than trusting the declared schema type.
      const currentPeriodEnd = rawPeriodEnd
        ? new Date(rawPeriodEnd)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const currentPeriodStart = new Date(currentPeriodEnd);
      currentPeriodStart.setMonth(currentPeriodStart.getMonth() - 1);
      const status = isTrial ? 'trialing' : currentPeriodEnd.getTime() > now.getTime() ? 'active' : 'past_due';

      // NOTE: partnerId on Subscription is the User._id (matches PartnerOperationsService's
      // usage of "partnerId" throughout), not Partner._id.
      await Subscription.findOneAndUpdate(
        { partnerId: user._id },
        {
          $set: {
            partnerId: user._id,
            planId,
            status,
            currentPeriodStart,
            currentPeriodEnd,
            trialEndsAt: user.trialEndsAt,
            cancelAtPeriodEnd: false,
            priceSnapshot: user.planPrice ?? 0,
            provider: 'manual',
          },
        },
        { upsert: true },
      );
      created++;
    } catch (err) {
      console.error(`  Error migrating user ${user._id}:`, err);
      errors++;
    }
  }

  console.log(`\nDone. Subscriptions upserted: ${created}, errors: ${errors}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
