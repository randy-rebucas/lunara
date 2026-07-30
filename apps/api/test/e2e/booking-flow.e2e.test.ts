/**
 * End-to-end test for the core money path: customer books an order, pays cash, and the order is
 * auto-dispatched to a partner shop — the exact flow "ready to serve booking" depends on.
 *
 * Uses an ephemeral in-memory MongoDB (mongodb-memory-server), never touches a real database, and
 * blanks out third-party credentials before the app boots so no real email/SMS/payment provider is
 * ever contacted, regardless of which code path executes.
 *
 * Run: npm run test:e2e --workspace=@lunara/api
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Must happen before any app code is imported — @nestjs/config loads .env with `override: false`,
// so pre-setting these to '' guarantees the real .env values are never used, no matter what.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.TWILIO_ACCOUNT_SID = '';
process.env.TWILIO_AUTH_TOKEN = '';
process.env.TWILIO_SMS_FROM_NUMBER = '';
process.env.TWILIO_VERIFY_SERVICE_SID = '';
process.env.PAYMONGO_SECRET_KEY = '';
process.env.FIREBASE_PROJECT_ID = '';
process.env.FIREBASE_CLIENT_EMAIL = '';
process.env.FIREBASE_PRIVATE_KEY = '';

import { MongoMemoryServer } from 'mongodb-memory-server';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import type { Connection } from 'mongoose';

let mongod: MongoMemoryServer;
let app: INestApplication;
let server: import('http').Server;
let connection: Connection;

const PICKUP_ADDRESS = {
  label: 'Home',
  addressType: 'home',
  line1: '123 Ayala Avenue',
  city: 'Makati',
  province: 'Metro Manila',
  postalCode: '1226',
  latitude: 14.5547,
  longitude: 121.0244,
  isDefault: true,
};

describe('booking → cash payment → shop auto-dispatch (e2e)', () => {
  let customerToken: string;
  let addressId: string;
  let orderId: string;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    // Mirrors main.ts's `import './preload-env'` (which runs before AppModule there too) — several
    // modules (e.g. AuthModule's JwtModule.register({ secret: getJwtSecret() })) read env vars
    // synchronously at require time, before Nest's own ConfigModule gets a chance to load .env, so
    // skipping this would sign JWTs with the 'dev-secret' fallback while everything else verifies
    // against the real secret from .env — the .env values already exist, we just need to load them
    // before anything reads them, same as production does.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../../dist/preload-env');

    // Runs against the compiled build (npm run build), not raw .ts source — decorator metadata for
    // Mongoose schemas only comes out correctly through a real tsc build, and app.module.js must be
    // required (not imported) after MONGODB_URI is set, since MongooseModule.forRoot(getMongoUri(), ...)
    // reads it synchronously at module-load time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppModule } = require('../../dist/app.module');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    server = app.getHttpServer();
    connection = app.get(getConnectionToken());

    await seedFixtures();

    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'e2e-customer@lunara.test', password: 'password123' })
      .expect(201);
    customerToken = loginRes.body.data.tokens.accessToken;
    assert.ok(customerToken, 'expected an access token from login');
  });

  after(async () => {
    await app?.close();
    await mongod?.stop();
  });

  it('creates a booking order for the seeded customer', async () => {
    // Real customers pick a slot from /booking/availability rather than an arbitrary timestamp —
    // the server only accepts scheduledPickupAt values that exactly match a generated slot boundary.
    const availabilityRes = await request(server)
      .get(`/api/v1/booking/availability?addressId=${addressId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const firstAvailableSlot = availabilityRes.body.data.slots.find((s: { available: boolean }) => s.available);
    assert.ok(firstAvailableSlot, 'expected at least one available pickup slot');
    const scheduledPickupAt = firstAvailableSlot.startAt;

    const res = await request(server)
      .post('/api/v1/booking/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        services: [{ bookingType: 'wash_fold', bagSizeId: 'medium' }],
        pickupAddressId: addressId,
        scheduledPickupAt,
      })
      .expect(201);

    assert.equal(res.body.success, true);
    orderId = res.body.data._id ?? res.body.data.id;
    assert.ok(orderId, 'expected an order id in the response');
    assert.equal(res.body.data.status, 'pending');
  });

  it('pays cash on pickup, which confirms and auto-dispatches the order to a shop', async () => {
    const res = await request(server)
      .post('/api/v1/payments/intent')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId, method: 'cash', cashTiming: 'pickup' })
      .expect(201);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.cash, true);
    assert.equal(res.body.data.paid, false); // cash is collected later by the rider, not now
  });

  it('shows the order as auto-dispatched to the seeded partner shop', async () => {
    const res = await request(server)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    const order = res.body.data;
    assert.equal(order.status, 'shop_assigned');
    assert.equal(order.dispatchStatus, 'dispatched');
    assert.ok(order.branchId, 'expected the order to be assigned to a branch');
  });

  /** Mirrors apps/api/src/scripts/seed.ts at minimal scope: one customer + address, one partner
   *  branch, and the laundry service catalog — just enough for a real booking to be quotable and
   *  payable end-to-end. */
  async function seedFixtures() {
    const db = connection.db!;
    const passwordHash = await bcrypt.hash('password123', 12);
    const now = new Date();

    const customerUser = await db.collection('users').insertOne({
      email: 'e2e-customer@lunara.test',
      phone: '+639170000001',
      passwordHash,
      role: 'customer',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('customers').insertOne({
      userId: customerUser.insertedId,
      firstName: 'E2E',
      lastName: 'Customer',
      loyaltyPoints: 0,
      createdAt: now,
      updatedAt: now,
    });

    const address = await db.collection('addresses').insertOne({
      userId: customerUser.insertedId,
      ...PICKUP_ADDRESS,
      createdAt: now,
      updatedAt: now,
    });
    addressId = address.insertedId.toString();

    const partnerUser = await db.collection('users').insertOne({
      email: 'e2e-partner@lunara.test',
      phone: '+639170000002',
      passwordHash,
      role: 'partner',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('branches').insertOne({
      code: 'E2E-01',
      name: 'E2E Test Shop',
      branchType: 'partner_shop',
      line1: '123 Ayala Ave',
      city: 'Makati',
      province: 'Metro Manila',
      partnerUserId: partnerUser.insertedId,
      managerUserId: partnerUser.insertedId,
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

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { reseedLaundryServices } = require('../../dist/modules/catalog/catalog.seed');
    await reseedLaundryServices(db.collection('laundry_services'));
  }
});
