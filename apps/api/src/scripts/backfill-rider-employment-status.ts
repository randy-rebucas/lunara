/**
 * One-time backfill for the new Rider.employmentStatus field (added for the partner-employed
 * rider onboarding flow). New Rider documents default to 'onboarding', which would silently
 * exclude every pre-existing rider from task assignment once rider-assignment.service.ts starts
 * filtering on employmentStatus === 'active'. Mongoose schema defaults only apply to documents
 * created after the field existed — they do not retroactively appear on rows already in Mongo —
 * so existing riders must be explicitly set to 'active' here before the gating logic is relied on.
 *
 * Idempotent — only touches documents where employmentStatus is missing.
 *
 *   npx ts-node src/scripts/backfill-rider-employment-status.ts
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';

const RiderSchema = new mongoose.Schema(
  { employmentStatus: String },
  { collection: 'riders', strict: false },
);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const Rider = mongoose.model('RiderEmploymentBackfill', RiderSchema);

  const result = await Rider.updateMany(
    { employmentStatus: { $exists: false } },
    { $set: { employmentStatus: 'active' } },
  );

  console.log(`Matched ${result.matchedCount}, updated ${result.modifiedCount} rider(s) to employmentStatus: 'active'.`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
