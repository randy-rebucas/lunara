/**
 * Seed dev users: partner, rider, admin, staff, customer (+ Metro Manila address)
 * Run: npm run seed --workspace=@lunara/api
 */
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { reseedLaundryAddons, reseedLaundryServices } from '../modules/catalog/catalog.seed';
import { reseedPromotions } from '../modules/promotions/promotions.seed';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run seed script with NODE_ENV=production — this would overwrite live data.');
}

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

const RIDER_HOME_ADDRESS = {
  line1: '456 EDSA',
  line2: 'Barangay Poblacion',
  city: 'Makati',
  province: 'Metro Manila',
  postalCode: '1210',
} as const;

const RIDER_DOCUMENT_TYPES = [
  'drivers_license',
  'or_cr',
  'nbi_clearance',
  'selfie',
] as const;

interface RiderSeedProfile {
  email: string;
  firstName: string;
  lastName: string;
  employmentType: 'employee' | 'independent_contractor';
  vehicleType: string;
  plateNumber: string;
  orCrNumber: string;
  homeAddress: typeof RIDER_HOME_ADDRESS;
  walletBalance: number;
  payoutMethod: 'gcash' | 'maya' | 'bank';
  gcashNumber?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
}

async function seedRiderProfile(
  db: import('mongodb').Db,
  users: import('mongodb').Collection,
  profile: RiderSeedProfile,
) {
  const riderUser = await users.findOne({ email: profile.email });
  if (!riderUser) return;

  const now = new Date();
  await db.collection('riders').updateOne(
    { userId: riderUser._id },
    {
      $set: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        employmentType: profile.employmentType,
        homeAddress: profile.homeAddress,
        vehicleType: profile.vehicleType,
        plateNumber: profile.plateNumber,
        orCrNumber: profile.orCrNumber,
        documents: RIDER_DOCUMENT_TYPES.map((type) => ({
          type,
          fileUrl: `/api/v1/uploads/rider-documents/${riderUser._id.toString()}-${type}-seed.jpg`,
          status: 'approved',
          uploadedAt: now,
          reviewedAt: now,
          reviewedBy: 'seed',
        })),
        isOnline: true,
        totalEarnings: profile.walletBalance,
        todayEarnings: 0,
        walletBalance: profile.walletBalance,
        walletBackfilled: true,
        payoutMethod: profile.payoutMethod,
        gcashNumber: profile.gcashNumber,
        bankName: profile.bankName,
        bankAccountName: profile.bankAccountName,
        bankAccountNumber: profile.bankAccountNumber,
        updatedAt: now,
      },
      $setOnInsert: {
        currentLocation: { type: 'Point', coordinates: [121.0244, 14.5547] },
        createdAt: now,
      },
    },
    { upsert: true },
  );
  console.log(
    `Seeded rider profile (${profile.employmentType}): ${profile.firstName} ${profile.lastName} — ${profile.email}`,
  );
}

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
    { email: 'rider2@lunara.dev', role: 'rider', phone: '+639176666666' },
    { email: 'rider3@lunara.dev', role: 'rider', phone: '+639177777777' },
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

  await seedRiderProfile(db, users, {
    email: 'rider@lunara.dev',
    firstName: 'Demo',
    lastName: 'Rider',
    employmentType: 'independent_contractor',
    homeAddress: RIDER_HOME_ADDRESS,
    vehicleType: 'motorcycle',
    plateNumber: 'ABC1234',
    orCrNumber: 'ORCR-SEED-001',
    walletBalance: 400,
    payoutMethod: 'gcash',
    gcashNumber: '09172222222',
  });

  await seedRiderProfile(db, users, {
    email: 'rider2@lunara.dev',
    firstName: 'Employee',
    lastName: 'Rider',
    employmentType: 'employee',
    homeAddress: RIDER_HOME_ADDRESS,
    vehicleType: 'motorcycle',
    plateNumber: 'EMP5678',
    orCrNumber: 'ORCR-SEED-002',
    walletBalance: 0,
    payoutMethod: 'bank',
    bankName: 'BDO',
    bankAccountName: 'Employee Rider',
    bankAccountNumber: '001234567890',
  });

  await seedRiderProfile(db, users, {
    email: 'rider3@lunara.dev',
    firstName: 'Contractor',
    lastName: 'Rider',
    employmentType: 'independent_contractor',
    homeAddress: RIDER_HOME_ADDRESS,
    vehicleType: 'bicycle',
    plateNumber: 'N/A',
    orCrNumber: 'N/A',
    walletBalance: 0,
    payoutMethod: 'gcash',
    gcashNumber: '09177777777',
  });

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

  const partnerUser = await users.findOne({ email: 'partner@lunara.dev' });
  const staffUser = await users.findOne({ email: 'staff@lunara.dev' });
  if (partnerUser && staffUser) {
    let branch = await db.collection('branches').findOne({ partnerUserId: partnerUser._id });
    if (!branch) {
      const now = new Date();
      const insert = await db.collection('branches').insertOne({
        code: 'MKT-01',
        name: 'Lunara Makati',
        branchType: 'partner_shop',
        line1: '123 Ayala Ave',
        city: 'Makati',
        province: 'Metro Manila',
        partnerUserId: partnerUser._id,
        managerUserId: partnerUser._id,
        maxActiveOrders: 25,
        maxWeightCapacityKg: 200,
        dailyQuotaOrders: 25,
        dailyQuotaWeightKg: 200,
        serviceRadiusKm: 12,
        isActive: true,
        location: { type: 'Point', coordinates: [121.0244, 14.5547] },
        createdAt: now,
        updatedAt: now,
      });
      branch = await db.collection('branches').findOne({ _id: insert.insertedId });
    }
    if (branch) {
      await users.updateOne(
        { _id: staffUser._id },
        { $set: { branchId: branch._id, updatedAt: new Date() } },
      );
      console.log(`Linked staff to branch: ${branch.name}`);
    }
  }

  console.log('Reseeding laundry services…');
  await reseedLaundryServices(db.collection('laundry_services'));

  console.log('Reseeding laundry add-ons…');
  await reseedLaundryAddons(db.collection('laundry_addons'));

  console.log('Reseeding promotions…');
  await reseedPromotions(db.collection('promotions'));

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
