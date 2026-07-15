/**
 * One-time correction for riders who historically remitted their FULL collected
 * cash (including their own fee) back before the 'remittanceMode' field existed.
 *
 * Bug: netEarningsAgainstCash() always assumed the rider would keep their fee in
 * cash and only hand over the net amount — it debited the rider's wallet balance
 * by the fee and posted rider_remittance_receivable/order_revenue_clearing for
 * netRemittance only. Riders who actually handed over the full cash amount were
 * never credited back that fee in the ledger or their wallet, understating
 * platform_cash and order_revenue_clearing, and overstating what the wallet
 * thinks they're owed.
 *
 * This script does NOT guess which riders were affected — that requires
 * cross-checking against real cash-drawer / payout records outside this system.
 * Two modes:
 *
 *   Report (default): lists every 'remitted' cash-remittance record still tagged
 *   'net_of_fee' with earningOffset > 0, grouped by rider, so you can compare
 *   against real records and decide which ones actually need correcting.
 *
 *     npx ts-node src/scripts/backfill-full-amount-remittances.ts
 *
 *   Apply: corrects only the remittance IDs you explicitly list — credits back
 *   the wallet, posts the same top-up ledger entries submitRemittance() now
 *   posts for 'full_amount' mode, immediately clears them through platform_cash
 *   (the cash was already physically received historically), and relabels the
 *   record. Idempotent per remittance ID — safe to re-run.
 *
 *     REMITTANCE_IDS=<id1>,<id2> npx ts-node src/scripts/backfill-full-amount-remittances.ts --apply
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';
const APPLY = process.argv.includes('--apply');
const TARGET_IDS = (process.env.REMITTANCE_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

interface RemittanceDoc {
  _id: mongoose.Types.ObjectId;
  riderUserId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  stage: string;
  cashAmount: number;
  earningOffset: number;
  netRemittance: number;
  remittanceMode: string;
  status: string;
}

const RemittanceSchema = new mongoose.Schema(
  {
    riderUserId: mongoose.Schema.Types.ObjectId,
    orderId: mongoose.Schema.Types.ObjectId,
    stage: String,
    cashAmount: Number,
    earningOffset: Number,
    netRemittance: Number,
    remittanceMode: { type: String, default: 'net_of_fee' },
    status: String,
  },
  { timestamps: true, collection: 'rider_cash_remittances' },
);

const LedgerEntrySchema = new mongoose.Schema(
  {
    transactionRef: String,
    accountType: String,
    accountSubject: { type: String, default: '' },
    direction: String,
    amount: Number,
    description: String,
    sourceType: String,
    sourceId: String,
  },
  { timestamps: true, collection: 'ledger_entries' },
);

const RiderSchema = new mongoose.Schema(
  { userId: mongoose.Schema.Types.ObjectId, walletBalance: Number },
  { collection: 'riders' },
);

const WalletTxnSchema = new mongoose.Schema(
  {
    riderUserId: mongoose.Schema.Types.ObjectId,
    type: String,
    amount: Number,
    reference: String,
    description: String,
  },
  { timestamps: true, collection: 'rider_wallet_transactions' },
);

async function report(Remittance: mongoose.Model<RemittanceDoc>) {
  // Mongoose schema defaults only apply to documents created after the field was added — they
  // don't retroactively appear on existing rows read back from the DB. Records from before
  // remittanceMode existed have no such field at all, and a { remittanceMode: 'net_of_fee' }
  // filter does NOT match a missing field, so those legacy rows must be matched explicitly too.
  const candidates = await Remittance.find({
    status: 'remitted',
    $or: [{ remittanceMode: 'net_of_fee' }, { remittanceMode: { $exists: false } }],
    earningOffset: { $gt: 0 },
  }).lean();

  if (candidates.length === 0) {
    console.log('No net_of_fee remitted records with a nonzero fee offset found. Nothing to review.');
    return;
  }

  const byRider = new Map<string, { count: number; totalOffset: number; ids: string[] }>();
  for (const c of candidates) {
    const key = c.riderUserId.toString();
    const entry = byRider.get(key) ?? { count: 0, totalOffset: 0, ids: [] };
    entry.count += 1;
    entry.totalOffset += c.earningOffset;
    entry.ids.push(c._id.toString());
    byRider.set(key, entry);
  }

  console.log(`\n${candidates.length} candidate records across ${byRider.size} rider(s).`);
  console.log('These are riders who may have remitted their full cash amount but are still booked as net_of_fee.');
  console.log('Cross-check against real payout/cash-drawer records before applying — do not bulk-apply this list.\n');

  for (const [riderId, info] of byRider) {
    console.log(`Rider ${riderId}: ${info.count} record(s), ${info.totalOffset.toFixed(2)} total fee potentially owed back`);
    console.log(`  IDs: ${info.ids.join(',')}`);
  }

  console.log('\nTo correct specific records, re-run with:');
  console.log('  REMITTANCE_IDS=<id1>,<id2> npx ts-node src/scripts/backfill-full-amount-remittances.ts --apply');
}

async function apply(
  Remittance: mongoose.Model<RemittanceDoc>,
  LedgerEntry: mongoose.Model<any>,
  Rider: mongoose.Model<any>,
  WalletTxn: mongoose.Model<any>,
) {
  if (TARGET_IDS.length === 0) {
    console.log('No REMITTANCE_IDS provided. Nothing to apply.');
    return;
  }

  const items = await Remittance.find({ _id: { $in: TARGET_IDS.map((id) => new mongoose.Types.ObjectId(id)) } });
  if (items.length === 0) {
    console.log('None of the given IDs were found.');
    return;
  }

  let corrected = 0;
  let skipped = 0;

  for (const item of items) {
    if (item.remittanceMode === 'full_amount') {
      console.log(`  Skipping ${item._id.toString()} — already marked full_amount.`);
      skipped++;
      continue;
    }
    if (item.earningOffset <= 0) {
      console.log(`  Skipping ${item._id.toString()} — no fee offset to correct.`);
      skipped++;
      continue;
    }

    const topupRef = `remittance-topup:${item._id.toString()}`;
    const clearRef = `remittance-backfill-clear:${item._id.toString()}`;
    const walletRef = `netting-reversal:${item.stage}:${item.orderId.toString()}`;

    const alreadyTopped = await LedgerEntry.findOne({ transactionRef: topupRef });
    if (!alreadyTopped) {
      await LedgerEntry.insertMany([
        {
          transactionRef: topupRef,
          sourceType: 'remittance',
          sourceId: item._id.toString(),
          accountType: 'rider_remittance_receivable',
          accountSubject: item.riderUserId.toString(),
          direction: 'debit',
          amount: item.earningOffset,
          description: `Backfill: full-amount remittance declared — receivable topped up for order ${item.orderId.toString().slice(-6)}`,
        },
        {
          transactionRef: topupRef,
          sourceType: 'remittance',
          sourceId: item._id.toString(),
          accountType: 'order_revenue_clearing',
          accountSubject: '',
          direction: 'credit',
          amount: item.earningOffset,
          description: `Backfill: order revenue recognized from cash collection top-up (order ${item.orderId.toString().slice(-6)})`,
        },
      ]);
    }

    // The remittance was already verified historically (status: 'remitted'), so the receivable
    // for this top-up amount is also already cleared — the cash was physically received back then.
    const alreadyCleared = await LedgerEntry.findOne({ transactionRef: clearRef });
    if (!alreadyCleared) {
      await LedgerEntry.insertMany([
        {
          transactionRef: clearRef,
          sourceType: 'remittance',
          sourceId: item._id.toString(),
          accountType: 'platform_cash',
          accountSubject: '',
          direction: 'debit',
          amount: item.earningOffset,
          description: `Backfill: cash remittance received (fee portion) from rider ${item.riderUserId.toString()} (order ${item.orderId.toString().slice(-6)})`,
        },
        {
          transactionRef: clearRef,
          sourceType: 'remittance',
          sourceId: item._id.toString(),
          accountType: 'rider_remittance_receivable',
          accountSubject: item.riderUserId.toString(),
          direction: 'credit',
          amount: item.earningOffset,
          description: `Backfill: remittance receivable cleared (fee portion) for rider ${item.riderUserId.toString()}`,
        },
      ]);
    }

    const alreadyReversed = await WalletTxn.findOne({ riderUserId: item.riderUserId, reference: walletRef });
    if (!alreadyReversed) {
      await Rider.updateOne({ userId: item.riderUserId }, { $inc: { walletBalance: item.earningOffset } });
      await WalletTxn.create({
        riderUserId: item.riderUserId,
        type: 'release',
        amount: item.earningOffset,
        reference: walletRef,
        description: `Backfill: fee netting reversed — rider remitted full cash for order ${item.orderId.toString().slice(-6)}`,
      });
    }

    item.remittanceMode = 'full_amount';
    await item.save();

    console.log(`  Corrected ${item._id.toString()} — rider ${item.riderUserId.toString()} — fee ₱${item.earningOffset} returned.`);
    corrected++;
  }

  console.log(`\nDone. Corrected: ${corrected}, Skipped: ${skipped}`);
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const Remittance = mongoose.model<RemittanceDoc>('RiderCashRemittanceBackfill', RemittanceSchema);
  const LedgerEntry = mongoose.model('LedgerEntryBackfill', LedgerEntrySchema);
  const Rider = mongoose.model('RiderBackfill', RiderSchema);
  const WalletTxn = mongoose.model('RiderWalletTransactionBackfill', WalletTxnSchema);

  if (APPLY) {
    await apply(Remittance, LedgerEntry, Rider, WalletTxn);
  } else {
    await report(Remittance);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
