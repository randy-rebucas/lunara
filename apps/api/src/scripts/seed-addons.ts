/**
 * Upsert default laundry add-ons with catalog images.
 * Run: npm run seed:addons --workspace=@lunara/api
 */
import mongoose from 'mongoose';
import { reseedLaundryAddons } from '../modules/catalog/catalog.seed';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;
  console.log('Reseeding laundry add-ons…');
  await reseedLaundryAddons(db.collection('laundry_addons'));
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
