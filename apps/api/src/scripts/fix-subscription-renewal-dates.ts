/**
 * One-off data fix: partners are entitled to a full year of service. Seed data had left
 * currentPeriodStart a year in the future of each subscription's actual createdAt (e.g. created
 * 2026-08-31 but periodStart 2027-xx-xx) — this resets currentPeriodStart back to the doc's own
 * createdAt date (the true anchor) and currentPeriodEnd to start + 1 year. Status is untouched.
 * Run: npx ts-node src/scripts/fix-subscription-renewal-dates.ts
 */
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';

function atMidnightUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;
  const collection = db.collection('partner_subscriptions');

  const subscriptions = await collection
    .find({}, { projection: { partnerId: 1, createdAt: 1, currentPeriodStart: 1, currentPeriodEnd: 1, status: 1 } })
    .toArray();

  console.log(`Found ${subscriptions.length} subscriptions.`);

  let updated = 0;
  for (const sub of subscriptions) {
    const newStart = atMidnightUtc(new Date(sub.createdAt));
    const newEnd = new Date(newStart);
    newEnd.setFullYear(newEnd.getFullYear() + 1);

    if (
      sub.currentPeriodStart?.getTime() === newStart.getTime() &&
      sub.currentPeriodEnd?.getTime() === newEnd.getTime()
    ) {
      continue;
    }

    await collection.updateOne(
      { _id: sub._id },
      { $set: { currentPeriodStart: newStart, currentPeriodEnd: newEnd } },
    );
    console.log(
      `  ${sub.partnerId} [${sub.status}]: start ${sub.currentPeriodStart?.toISOString()} -> ${newStart.toISOString()}, end ${sub.currentPeriodEnd?.toISOString()} -> ${newEnd.toISOString()}`,
    );
    updated++;
  }

  console.log(`Updated ${updated} of ${subscriptions.length} subscriptions.`);
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
