/**
 * Regression test for the accounting-workflow-integrity audit: admin's "record subscription
 * payment" action (bank transfer/GCash settled outside the invoice cycle) must not advance the
 * partner's billing period, post to the ledger twice, or write a duplicate PartnerInvoice when
 * the same request is retried/replayed with the same idempotencyKey — see
 * PartnerOperationsService.recordSubscriptionPayment and LedgerService.claim. It must also write
 * exactly one paid, zero-order PartnerInvoice per real payment, since the partner-web
 * Accounts/Income/Profit & Loss/Transactions pages all aggregate from /partner/invoices and would
 * otherwise never show this payment happened.
 *
 * Uses an ephemeral in-memory MongoDB (mongodb-memory-server), never touches a real database, and
 * blanks out third-party credentials before the app boots, same as booking-flow.e2e.test.ts.
 *
 * Run: npm run test:e2e --workspace=@lunara/api
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

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
import { Types, type Connection } from 'mongoose';

let mongod: MongoMemoryServer;
let app: INestApplication;
let server: import('http').Server;
let connection: Connection;

let partnerUserId: string;
let partnerObjectId: Types.ObjectId;

describe('admin records a subscription payment (e2e)', () => {
  let adminToken: string;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../../dist/preload-env');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppModule } = require('../../dist/app.module');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    server = app.getHttpServer();
    connection = app.get(getConnectionToken());
    // Mongoose builds indexes in the background after model registration — without waiting for
    // them here, the ledger_transaction_markers unique index (which the idempotency guard being
    // tested relies on) may not exist yet when the first request races in, letting a duplicate
    // slip through under test even though it wouldn't in a longer-lived real server.
    await connection.syncIndexes();

    await seedFixtures();

    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'e2e-admin@lunara.test', password: 'password123' })
      .expect(201);
    adminToken = loginRes.body.data.tokens.accessToken;
    assert.ok(adminToken, 'expected an access token from login');
  });

  after(async () => {
    await app?.close();
    await mongod?.stop();
  });

  it('advances the billing period and posts one ledger transaction', async () => {
    const before = await connection.db!
      .collection('partner_subscriptions')
      .findOne({ partnerId: partnerObjectId });
    const originalPeriodEnd = new Date(before!.currentPeriodEnd).getTime();

    const res = await request(server)
      .post(`/api/v1/admin/partners/${partnerUserId}/subscription/record-payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amountPhp: 999, paymentReference: 'GCASH-001', idempotencyKey: 'test-key-1' })
      .expect(201);
    assert.equal(res.body.success, true);

    const after = await connection.db!
      .collection('partner_subscriptions')
      .findOne({ partnerId: partnerObjectId });
    assert.ok(new Date(after!.currentPeriodEnd).getTime() > originalPeriodEnd, 'expected the period to advance');

    const ledgerCount = await connection.db!
      .collection('ledger_entries')
      .countDocuments({ transactionRef: `manual-subscription-payment:${after!._id.toString()}:test-key-1` });
    assert.equal(ledgerCount, 2, 'expected one balanced debit+credit pair posted');

    const invoiceCount = await connection.db!
      .collection('partner_invoices')
      .countDocuments({ partnerId: partnerObjectId, status: 'paid', subscriptionFeeDue: 999 });
    assert.equal(invoiceCount, 1, 'expected one paid invoice recording the manual payment');
  });

  it('is a no-op when the same idempotencyKey is replayed', async () => {
    const before = await connection.db!
      .collection('partner_subscriptions')
      .findOne({ partnerId: partnerObjectId });

    const res = await request(server)
      .post(`/api/v1/admin/partners/${partnerUserId}/subscription/record-payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amountPhp: 999, paymentReference: 'GCASH-001', idempotencyKey: 'test-key-1' })
      .expect(201);
    assert.equal(res.body.duplicate, true, 'expected the replay to be reported as a duplicate');

    const after = await connection.db!
      .collection('partner_subscriptions')
      .findOne({ partnerId: partnerObjectId });
    assert.equal(
      new Date(after!.currentPeriodEnd).getTime(),
      new Date(before!.currentPeriodEnd).getTime(),
      'replayed request must not advance the period a second time',
    );

    const ledgerCount = await connection.db!
      .collection('ledger_entries')
      .countDocuments({ transactionRef: `manual-subscription-payment:${after!._id.toString()}:test-key-1` });
    assert.equal(ledgerCount, 2, 'replayed request must not post a second ledger transaction');

    const invoiceCount = await connection.db!
      .collection('partner_invoices')
      .countDocuments({ partnerId: partnerObjectId, status: 'paid', subscriptionFeeDue: 999 });
    assert.equal(invoiceCount, 1, 'replayed request must not write a second invoice');
  });

  async function seedFixtures() {
    const db = connection.db!;
    const passwordHash = await bcrypt.hash('password123', 12);
    const now = new Date();

    await db.collection('users').insertOne({
      email: 'e2e-admin@lunara.test',
      phone: '+639170000003',
      passwordHash,
      role: 'admin',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const partnerUser = await db.collection('users').insertOne({
      email: 'e2e-sub-partner@lunara.test',
      phone: '+639170000004',
      passwordHash,
      role: 'partner',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    partnerUserId = partnerUser.insertedId.toString();
    partnerObjectId = partnerUser.insertedId;

    const plan = await db.collection('plans').insertOne({
      key: 'starter',
      name: 'Starter',
      monthlyPrice: 999,
      trialDays: 0,
      limits: {},
      features: {},
      addOns: [],
      upgradeFee: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await db.collection('partner_subscriptions').insertOne({
      partnerId: partnerUser.insertedId,
      planId: plan.insertedId,
      status: 'past_due',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      priceSnapshot: 999,
      provider: 'manual',
      paymentMethodOnFile: false,
      createdAt: now,
      updatedAt: now,
    });
  }
});
