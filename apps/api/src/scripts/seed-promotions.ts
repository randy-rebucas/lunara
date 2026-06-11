/**
 * Upsert default promotion catalog (WELCOME10, SIGNUP15, FREEDEL50, FLASH50).
 * Run: npm run seed:promotions --workspace=@lunara/api
 */
import mongoose from 'mongoose';
import { reseedPromotions } from '../modules/promotions/promotions.seed';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;
  console.log('Reseeding promotions…');
  await reseedPromotions(db.collection('promotions'));
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
