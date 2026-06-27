/**
 * One-time utility: reset all settlement data for a specific partner.
 *
 * What it does:
 *   1. Finds the partner branch by partnerUserId
 *   2. Deletes all PartnerSettlement documents for that partner
 *   3. Clears settlementId from all orders belonging to that branch
 *   4. Deletes all ledger entries whose sourceType is 'settlement' for those settlements
 *
 * Run:
 *   PARTNER_ID=<userId> npx ts-node src/scripts/reset-partner-settlements.ts
 *
 * Example:
 *   PARTNER_ID=665f1a2b3c4d5e6f7a8b9c0d npx ts-node src/scripts/reset-partner-settlements.ts
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';
const PARTNER_ID = process.env.PARTNER_ID;

if (!PARTNER_ID) {
  console.error('ERROR: PARTNER_ID env variable is required.');
  console.error('Usage: PARTNER_ID=<userId> npx ts-node src/scripts/reset-partner-settlements.ts');
  process.exit(1);
}

const BranchSchema = new mongoose.Schema(
  { partnerUserId: mongoose.Schema.Types.ObjectId },
  { collection: 'branches' },
);

const SettlementSchema = new mongoose.Schema(
  { partnerId: mongoose.Schema.Types.ObjectId },
  { collection: 'partner_settlements' },
);

const OrderSchema = new mongoose.Schema(
  { branchId: mongoose.Schema.Types.ObjectId, settlementId: mongoose.Schema.Types.ObjectId },
  { collection: 'orders' },
);

const LedgerEntrySchema = new mongoose.Schema(
  { sourceType: String, sourceId: String },
  { collection: 'ledger_entries' },
);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const Branch = mongoose.model('Branch', BranchSchema);
  const Settlement = mongoose.model('Settlement', SettlementSchema);
  const Order = mongoose.model('Order', OrderSchema);
  const LedgerEntry = mongoose.model('LedgerEntry', LedgerEntrySchema);

  // 1. Find the partner's branch
  const branch = await Branch.findOne({ partnerUserId: new mongoose.Types.ObjectId(PARTNER_ID) }).lean();
  if (!branch) {
    console.error(`No branch found for partnerUserId=${PARTNER_ID}`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Found branch: ${branch._id}`);

  // 2. Find all settlements for this partner
  const settlements = await Settlement.find({ partnerId: new mongoose.Types.ObjectId(PARTNER_ID) }).lean();
  console.log(`Found ${settlements.length} settlement(s) to delete.`);

  if (settlements.length === 0) {
    console.log('Nothing to reset.');
    await mongoose.disconnect();
    return;
  }

  const settlementIds = settlements.map((s) => s._id);

  // 3. Delete ledger entries linked to these settlements
  const ledgerResult = await LedgerEntry.deleteMany({
    sourceType: 'settlement',
    sourceId: { $in: settlementIds.map((id) => id.toString()) },
  });
  console.log(`Deleted ${ledgerResult.deletedCount} ledger entry(ies).`);

  // 4. Clear settlementId from orders in that branch
  const orderResult = await Order.updateMany(
    { branchId: branch._id, settlementId: { $in: settlementIds } },
    { $unset: { settlementId: '' } },
  );
  console.log(`Unlinked settlementId from ${orderResult.modifiedCount} order(s).`);

  // 5. Delete the settlements
  const settlementResult = await Settlement.deleteMany({ _id: { $in: settlementIds } });
  console.log(`Deleted ${settlementResult.deletedCount} settlement(s).`);

  console.log('\nDone. Settlement data for this partner has been reset.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Script failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
