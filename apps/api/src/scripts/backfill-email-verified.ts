/**
 * One-time migration: grandfather existing accounts as email-verified.
 *
 * isEmailVerified was added to gate login for email-registered accounts behind a
 * verification link. Users who registered before this feature shipped never went
 * through that flow and would otherwise get locked out of their existing accounts,
 * so this marks every pre-existing email-having user as verified.
 *
 * Run: npx ts-node src/scripts/backfill-email-verified.ts
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';

const UserSchema = new mongoose.Schema(
  {
    email: String,
    isEmailVerified: Boolean,
    emailVerifiedAt: Date,
  },
  { timestamps: true, collection: 'users' },
);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const User = mongoose.model('User', UserSchema);

  const result = await User.updateMany(
    { email: { $exists: true, $ne: null }, isEmailVerified: { $ne: true } },
    { $set: { isEmailVerified: true, emailVerifiedAt: new Date() } },
  );

  console.log(`Done. Grandfathered ${result.modifiedCount} existing user(s) as email-verified.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
