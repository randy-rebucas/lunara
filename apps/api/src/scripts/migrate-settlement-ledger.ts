/**
 * One-time migration: fix partner_payable ledger entries from past settlements.
 *
 * Bug: createSettlement() credited partner_payable (increasing liability) but
 * never debited it after marking the settlement paid. This caused the outstanding
 * balance to grow indefinitely on the partner-web settlements page.
 *
 * Fix applied going forward: settlements now credit cash_out directly.
 * This script corrects historical records by posting a corrective transaction
 * per settlement that already has a partner_payable credit entry:
 *   - Debit  partner_payable  (clears the liability)
 *   - Credit cash_out         (records the payment that was already made)
 *
 * Run: npx ts-node src/scripts/migrate-settlement-ledger.ts
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';

interface LedgerEntryDoc {
  _id: mongoose.Types.ObjectId;
  transactionRef: string;
  accountType: string;
  accountSubject: string;
  direction: string;
  amount: number;
  description: string;
  sourceType: string;
  sourceId: string;
}

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

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const LedgerEntry = mongoose.model<LedgerEntryDoc>('LedgerEntry', LedgerEntrySchema);

  // Find all partner_payable credit entries from settlements
  const badEntries = await LedgerEntry.find({
    accountType: 'partner_payable',
    direction: 'credit',
    sourceType: 'settlement',
  }).lean();

  if (badEntries.length === 0) {
    console.log('No partner_payable settlement credits found. Nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${badEntries.length} partner_payable credit entries to correct.`);

  let skipped = 0;
  let corrected = 0;

  for (const entry of badEntries) {
    const correctionRef = `settlement-correction:${entry.sourceId}`;

    // Idempotent: skip if correction already posted
    const existing = await LedgerEntry.findOne({ transactionRef: correctionRef });
    if (existing) {
      skipped++;
      continue;
    }

    await LedgerEntry.insertMany([
      {
        transactionRef: correctionRef,
        sourceType: 'settlement',
        sourceId: entry.sourceId,
        accountType: 'partner_payable',
        accountSubject: entry.accountSubject,
        direction: 'debit',
        amount: entry.amount,
        description: `Correction: partner_payable cleared for settled settlement ${entry.sourceId}`,
      },
      {
        transactionRef: correctionRef,
        sourceType: 'settlement',
        sourceId: entry.sourceId,
        accountType: 'cash_out',
        accountSubject: '',
        direction: 'credit',
        amount: entry.amount,
        description: `Correction: cash paid out to partner for settlement ${entry.sourceId}`,
      },
    ]);

    console.log(`  Corrected settlement ${entry.sourceId} — partner ${entry.accountSubject} — ₱${entry.amount}`);
    corrected++;
  }

  console.log(`\nDone. Corrected: ${corrected}, Already fixed: ${skipped}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
