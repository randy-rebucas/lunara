/**
 * Upsert default laundry service catalog (9 booking types; 3 active by default).
 * Run: npm run seed:services --workspace=@lunara/api
 */
import mongoose from 'mongoose';
import { reseedLaundryServices } from '../modules/catalog/catalog.seed';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;
  console.log('Reseeding laundry services…');
  await reseedLaundryServices(db.collection('laundry_services'));
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
