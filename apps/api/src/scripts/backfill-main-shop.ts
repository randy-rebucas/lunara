/**
 * One-time migration: designate exactly one "main shop" branch per partner.
 *
 * Branch.isMainShop was added so shop counts and customer-facing listings can
 * treat a partner's other branches as variants of one shop, instead of counting
 * every branch as an independent shop. Existing data has no branch marked main,
 * so this picks the earliest-created active branch per partnerUserId as main.
 *
 * Partners with >1 pre-existing branch are logged for manual review — the
 * earliest-created branch may not be the partner's real flagship location.
 *
 * Run: npx ts-node src/scripts/backfill-main-shop.ts
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';

interface BranchDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  partnerUserId: mongoose.Types.ObjectId;
  isActive: boolean;
  branchType: string;
  createdAt: Date;
}

const BranchSchema = new mongoose.Schema(
  {
    name: String,
    code: String,
    partnerUserId: mongoose.Schema.Types.ObjectId,
    isActive: Boolean,
    branchType: String,
    isMainShop: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'branches' },
);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const Branch = mongoose.model<BranchDoc>('Branch', BranchSchema);

  const branches = await Branch.find({ branchType: { $ne: 'hq' } })
    .sort({ createdAt: 1 })
    .lean();

  const byPartner = new Map<string, BranchDoc[]>();
  for (const b of branches) {
    const key = b.partnerUserId.toString();
    const list = byPartner.get(key) ?? [];
    list.push(b);
    byPartner.set(key, list);
  }

  let designated = 0;
  let reviewFlagged = 0;

  for (const [partnerId, list] of byPartner) {
    const activeBranches = list.filter((b) => b.isActive);
    const candidate = activeBranches[0] ?? list[0];
    if (!candidate) continue;

    await Branch.updateMany({ partnerUserId: candidate.partnerUserId }, { $set: { isMainShop: false } });
    await Branch.updateOne({ _id: candidate._id }, { $set: { isMainShop: true } });
    designated++;

    if (list.length > 1) {
      reviewFlagged++;
      console.log(
        `  Partner ${partnerId}: ${list.length} branches — designated "${candidate.name}" (${candidate.code}) as main. Review if incorrect.`,
      );
    }
  }

  console.log(`\nDone. Main shop designated for ${designated} partner(s); ${reviewFlagged} flagged for manual review.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
