/**
 * One-time cleanup for the `notifications` collection.
 *
 * The TTL index added on Notification.expiresAt only auto-expires documents going forward —
 * existing rows predate it and have no expiresAt at all, so MongoDB will never touch them.
 * This script:
 *   1. Deletes rows already past the retention policy (read notifications older than 30 days,
 *      unread ones older than 90) — see notificationExpiryFor in the schema for the same rule.
 *   2. Backfills expiresAt on everything else so the TTL index takes over from here on.
 *
 * Run: npx ts-node src/scripts/cleanup-notifications.ts
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';

const READ_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const UNREAD_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const notifications = mongoose.connection.db!.collection('notifications');
  const now = Date.now();
  const readCutoff = new Date(now - READ_RETENTION_MS);
  const unreadCutoff = new Date(now - UNREAD_RETENTION_MS);

  const deleteResult = await notifications.deleteMany({
    $or: [
      { read: true, createdAt: { $lt: readCutoff } },
      { read: false, createdAt: { $lt: unreadCutoff } },
    ],
  });
  console.log(`Deleted ${deleteResult.deletedCount} already-stale notification(s).`);

  // createdAt is a mongoose timestamp, but some legacy rows have it stored as a string —
  // $toDate normalizes either shape before the $add, with $ifNull covering rows missing it entirely.
  const readBackfill = await notifications.updateMany(
    { read: true, expiresAt: { $exists: false } },
    [{ $set: { expiresAt: { $add: [{ $toDate: { $ifNull: ['$createdAt', new Date()] } }, READ_RETENTION_MS] } } }],
  );
  const unreadBackfill = await notifications.updateMany(
    { read: false, expiresAt: { $exists: false } },
    [{ $set: { expiresAt: { $add: [{ $toDate: { $ifNull: ['$createdAt', new Date()] } }, UNREAD_RETENTION_MS] } } }],
  );
  console.log(
    `Backfilled expiresAt on ${readBackfill.modifiedCount} read and ${unreadBackfill.modifiedCount} unread notification(s).`,
  );

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
