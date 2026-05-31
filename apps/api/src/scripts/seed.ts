/**
 * Seed dev users: partner, rider, admin, staff, customer (+ Metro Manila address)
 * Run: npm run seed --workspace=@lunara/api
 */
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara';

const CUSTOMER_HOME_ADDRESS = {
  label: 'Home',
  addressType: 'home',
  line1: '123 Ayala Avenue',
  line2: 'Unit 12B',
  city: 'Makati',
  province: 'Metro Manila',
  postalCode: '1226',
  latitude: 14.5547,
  longitude: 121.0244,
  isDefault: true,
} as const;

async function seed() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;
  const users = db.collection('users');

  const passwordHash = await bcrypt.hash('password123', 12);
  const seeds = [
    { email: 'partner@lunara.dev', role: 'partner', phone: '+639171111111' },
    { email: 'rider@lunara.dev', role: 'rider', phone: '+639172222222' },
    { email: 'admin@lunara.dev', role: 'admin', phone: '+639173333333' },
    { email: 'staff@lunara.dev', role: 'staff', phone: '+639174444444' },
    { email: 'customer@lunara.dev', role: 'customer', phone: '+639175555555' },
  ];

  for (const s of seeds) {
    await users.updateOne(
      { email: s.email },
      {
        $set: {
          email: s.email,
          phone: s.phone,
          passwordHash,
          role: s.role,
          isActive: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    console.log(`Seeded ${s.role}: ${s.email} / password123`);
  }

  const riderUser = await users.findOne({ email: 'rider@lunara.dev' });
  if (riderUser) {
    await db.collection('riders').updateOne(
      { userId: riderUser._id },
      {
        $set: { isOnline: true, vehicleType: 'motorcycle', totalEarnings: 0 },
        $setOnInsert: {
          currentLocation: { type: 'Point', coordinates: [121.0244, 14.5547] },
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
  }

  const customerUser = await users.findOne({ email: 'customer@lunara.dev' });
  if (customerUser) {
    await db.collection('customers').updateOne(
      { userId: customerUser._id },
      {
        $set: {
          firstName: 'Demo',
          lastName: 'Customer',
          loyaltyPoints: 100,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    console.log('Seeded customer profile: Demo Customer');

    await db.collection('addresses').updateMany(
      { userId: customerUser._id },
      { $set: { isDefault: false } },
    );

    await db.collection('addresses').updateOne(
      { userId: customerUser._id, label: CUSTOMER_HOME_ADDRESS.label },
      {
        $set: {
          userId: customerUser._id,
          ...CUSTOMER_HOME_ADDRESS,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    console.log(
      `Seeded customer address: ${CUSTOMER_HOME_ADDRESS.line1}, ${CUSTOMER_HOME_ADDRESS.city}`,
    );
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
