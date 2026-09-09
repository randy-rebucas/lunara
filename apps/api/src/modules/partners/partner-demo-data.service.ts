import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { reseedLaundryAddons, reseedLaundryServices } from '../catalog/catalog.seed';

const DEMO_RIDER_HOME_ADDRESS = {
  line1: '456 EDSA',
  line2: 'Barangay Poblacion',
  city: 'Makati',
  province: 'Metro Manila',
  postalCode: '1210',
} as const;

/** Ten customers spanning the shop's regular clientele — reused across orders so the demo reads
 * like a real week of bookings rather than one customer placing every order. */
const DEMO_CUSTOMERS = [
  { firstName: 'Marisol', lastName: 'Reyes', line1: '12 Kalayaan Ave', unit: 'Unit 4B' },
  { firstName: 'Kevin', lastName: 'Domingo', line1: '45 Malakas St', unit: 'Unit 2' },
  { firstName: 'Ana', lastName: 'Lopez', line1: '78 Matapang St', unit: '' },
  { firstName: 'Grace', lastName: 'Santos', line1: '9 Maginhawa St', unit: 'Unit 7' },
  { firstName: 'Paolo', lastName: 'Cruz', line1: '23 Tomas Morato Ave', unit: '' },
  { firstName: 'Bea', lastName: 'Ramos', line1: '101 Aurora Blvd', unit: 'Unit 12' },
  { firstName: 'Jomar', lastName: 'Villanueva', line1: '5 Xavierville Ave', unit: '' },
  { firstName: 'Cathy', lastName: 'Tan', line1: '67 Katipunan Ave', unit: 'Unit 3A' },
  { firstName: 'Ronald', lastName: 'Garcia', line1: '30 Scout Rallos St', unit: '' },
  { firstName: 'Divine', lastName: 'Mendoza', line1: '18 Timog Ave', unit: 'Unit 9' },
] as const;

/** Two staff accounts — one manager (settings access) and one order-processing associate. */
const DEMO_STAFF = [
  { firstName: 'Liza', lastName: 'Fernandez', department: 'Shop Floor', canManageSettings: true },
  { firstName: 'Mico', lastName: 'Torres', department: 'Shop Floor', canManageSettings: false },
] as const;

const DEMO_INVENTORY_ITEMS = [
  { sku: 'DET-001', name: 'Liquid Detergent', category: 'supplies', quantity: 42, unit: 'liters', lowStockThreshold: 15, usagePerOrder: 0, usagePerKg: 0.05 },
  { sku: 'SOFT-001', name: 'Fabric Softener', category: 'supplies', quantity: 30, unit: 'liters', lowStockThreshold: 10, usagePerOrder: 0, usagePerKg: 0.03 },
  { sku: 'BAG-001', name: 'Laundry Bags', category: 'packaging', quantity: 8, unit: 'pieces', lowStockThreshold: 20, usagePerOrder: 1, usagePerKg: 0 },
  { sku: 'HNG-001', name: 'Plastic Hangers', category: 'packaging', quantity: 150, unit: 'pieces', lowStockThreshold: 50, usagePerOrder: 0, usagePerKg: 0 },
  { sku: 'STN-001', name: 'Stain Remover', category: 'supplies', quantity: 12, unit: 'bottles', lowStockThreshold: 5, usagePerOrder: 0, usagePerKg: 0 },
  { sku: 'TAG-001', name: 'Garment Tags', category: 'packaging', quantity: 200, unit: 'pieces', lowStockThreshold: 40, usagePerOrder: 1, usagePerKg: 0 },
] as const;

/** Ten orders forming one realistic day-to-day pipeline: freshly booked through fully closed out,
 * touching every stage a shop actually works through (pickup dispatch, shop receiving, wash
 * stages, delivery dispatch, completion). Each maps to a distinct demo customer. */
const DEMO_ORDER_PIPELINE = [
  { status: 'pending', bookingType: 'wash_fold', quantity: 2, unitPrice: 150, daysAgo: 0, fulfillmentType: 'delivery' },
  { status: 'rider_assigned_pickup', bookingType: 'wash_dry_fold', quantity: 2, unitPrice: 175, daysAgo: 0, fulfillmentType: 'delivery' },
  { status: 'picked_up', bookingType: 'dry_cleaning', quantity: 3, unitPrice: 150, daysAgo: 1, fulfillmentType: 'delivery' },
  { status: 'received_at_shop', bookingType: 'wash_fold', quantity: 3, unitPrice: 150, daysAgo: 1, fulfillmentType: 'customer_pickup' },
  { status: 'washing', bookingType: 'ironing', quantity: 5, unitPrice: 40, daysAgo: 2, fulfillmentType: 'delivery' },
  { status: 'folding', bookingType: 'shoes', quantity: 2, unitPrice: 125, daysAgo: 2, fulfillmentType: 'delivery' },
  { status: 'ready_for_delivery', bookingType: 'comforters', quantity: 1, unitPrice: 400, daysAgo: 3, fulfillmentType: 'delivery' },
  { status: 'rider_assigned_delivery', bookingType: 'wash_dry_fold', quantity: 2, unitPrice: 175, daysAgo: 3, fulfillmentType: 'delivery' },
  { status: 'out_for_delivery', bookingType: 'wash_fold', quantity: 4, unitPrice: 150, daysAgo: 4, fulfillmentType: 'delivery' },
  { status: 'completed', bookingType: 'dry_cleaning', quantity: 2, unitPrice: 150, daysAgo: 6, fulfillmentType: 'delivery' },
] as const;

/** Stage cutoffs used to decide how much of an order's pickup/shopReceiving/delivery sub-timeline
 * to backfill — an order sitting at "washing" should already show a completed pickup, one still
 * "pending" should show none of it yet. */
const PIPELINE_ORDER = [
  'pending',
  'rider_assigned_pickup',
  'picked_up',
  'received_at_shop',
  'washing',
  'folding',
  'ready_for_delivery',
  'rider_assigned_delivery',
  'out_for_delivery',
  'completed',
] as const;

function stageIndex(status: string) {
  return PIPELINE_ORDER.indexOf(status as (typeof PIPELINE_ORDER)[number]);
}

/**
 * Seeds/clears a full round of demo data (orders, customers, staff, inventory, ledger entries,
 * marketing, and communications) for one newly-onboarded partner, so a fresh shop opens into
 * something that already looks like a working week rather than an empty dashboard.
 *
 * Everything this creates is scoped to the partner's own user id and tagged `isDemoData: true`,
 * so `clearDemoData` can remove exactly and only what `seedDemoData` created. Demo customer/staff/
 * rider accounts are internal FK targets only — nobody logs in as them, so they use unusable
 * random passwords, not shared credentials.
 */
@Injectable()
export class PartnerDemoDataService {
  private readonly logger = new Logger(PartnerDemoDataService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  private demoCustomerEmail(ownerUserId: string, index: number) {
    return `demo-customer-${index}+${ownerUserId}@lunara.internal`;
  }

  private demoRiderEmail(ownerUserId: string) {
    return `demo-rider+${ownerUserId}@lunara.internal`;
  }

  private demoStaffEmail(ownerUserId: string, index: number) {
    return `demo-staff-${index}+${ownerUserId}@lunara.internal`;
  }

  async seedDemoData(ownerUserId: string, branchId: string): Promise<void> {
    const db = this.connection.db!;
    const users = db.collection('users');
    const ownerObjectId = new Types.ObjectId(ownerUserId);
    const branchObjectId = new Types.ObjectId(branchId);

    const branch = await db.collection('branches').findOne({ _id: branchObjectId });
    if (!branch) {
      this.logger.warn(`Skipping demo data seed — branch ${branchId} not found for ${ownerUserId}`);
      return;
    }

    const partner = await db.collection('partners').findOne({ ownerUserId: ownerObjectId });
    const now = new Date();
    // Random, never-communicated password — these accounts exist only as FK targets on demo data.
    const placeholderPasswordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 12);

    // ── Customers (10) ──────────────────────────────────────────────────────
    const customerUserIds: Types.ObjectId[] = [];
    const customerAddressIds: Types.ObjectId[] = [];
    for (let i = 0; i < DEMO_CUSTOMERS.length; i++) {
      const spec = DEMO_CUSTOMERS[i];
      const email = this.demoCustomerEmail(ownerUserId, i + 1);
      await users.updateOne(
        { email },
        {
          $set: {
            email,
            passwordHash: placeholderPasswordHash,
            role: 'customer',
            isActive: true,
            isDemoData: true,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
      const customerUser = await users.findOne({ email });
      customerUserIds.push(customerUser!._id);

      await db.collection('customers').updateOne(
        { userId: customerUser!._id },
        {
          $set: {
            firstName: spec.firstName,
            lastName: spec.lastName,
            loyaltyPoints: (i + 1) * 15,
            isDemoData: true,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );

      await db.collection('addresses').updateOne(
        { userId: customerUser!._id, label: 'Home' },
        {
          $set: {
            userId: customerUser!._id,
            label: 'Home',
            addressType: 'home',
            line1: spec.line1,
            line2: spec.unit || undefined,
            city: 'Quezon City',
            province: 'Metro Manila',
            postalCode: '1100',
            latitude: 14.6488 + i * 0.001,
            longitude: 121.0509 + i * 0.001,
            isDefault: true,
            isDemoData: true,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
      const address = await db
        .collection('addresses')
        .findOne({ userId: customerUser!._id, label: 'Home' });
      customerAddressIds.push(address!._id);
    }

    // ── Rider (pickup + delivery) ───────────────────────────────────────────
    const riderEmail = this.demoRiderEmail(ownerUserId);
    await users.updateOne(
      { email: riderEmail },
      {
        $set: {
          email: riderEmail,
          passwordHash: placeholderPasswordHash,
          role: 'rider',
          isActive: true,
          isDemoData: true,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    const riderUser = await users.findOne({ email: riderEmail });
    await db.collection('riders').updateOne(
      { userId: riderUser!._id },
      {
        $set: {
          firstName: 'Sample',
          lastName: 'Rider',
          employmentType: 'independent_contractor',
          homeAddress: DEMO_RIDER_HOME_ADDRESS,
          vehicleType: 'motorcycle',
          plateNumber: 'DEMO0001',
          orCrNumber: 'ORCR-DEMO-001',
          isOnline: true,
          totalEarnings: 1850,
          todayEarnings: 150,
          walletBalance: 320,
          walletBackfilled: true,
          payoutMethod: 'gcash',
          gcashNumber: '09170000000',
          isDemoData: true,
          updatedAt: now,
        },
        $setOnInsert: {
          currentLocation: { type: 'Point', coordinates: [121.0244, 14.5547] },
          createdAt: now,
        },
      },
      { upsert: true },
    );

    // ── Staff (2) ────────────────────────────────────────────────────────────
    for (let i = 0; i < DEMO_STAFF.length; i++) {
      const spec = DEMO_STAFF[i];
      const email = this.demoStaffEmail(ownerUserId, i + 1);
      await users.updateOne(
        { email },
        {
          $set: {
            email,
            passwordHash: placeholderPasswordHash,
            role: 'staff',
            branchId: branchObjectId,
            ownerName: `${spec.firstName} ${spec.lastName}`,
            department: spec.department,
            canManageSettings: spec.canManageSettings,
            isActive: true,
            isDemoData: true,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
    }

    // ── Inventory ────────────────────────────────────────────────────────────
    for (const item of DEMO_INVENTORY_ITEMS) {
      await db.collection('shop_inventory').updateOne(
        { branchId: branchObjectId, sku: item.sku },
        {
          $set: {
            branchId: branchObjectId,
            ...item,
            isDemoData: true,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
    }

    // Shared/global catalog — safe and idempotent to (re)run, nothing partner-specific here.
    await reseedLaundryServices(db.collection('laundry_services'));
    await reseedLaundryAddons(db.collection('laundry_addons'));

    // ── Marketing: promo + campaigns ────────────────────────────────────────
    const promoCode = `TESTDEMO-${ownerUserId.slice(-6).toUpperCase()}`;
    await db.collection('promotions').updateOne(
      { code: promoCode },
      {
        $set: {
          code: promoCode,
          title: 'Sample welcome discount',
          description: '10% off — seeded as demo data',
          discountType: 'percent',
          discountValue: 10,
          minOrderAmount: 200,
          isActive: true,
          audience: 'all',
          kind: 'standard',
          partnerUserId: ownerObjectId,
          fundedBy: 'partner',
          approvalStatus: 'approved',
          isDemoData: true,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    const existingCampaigns = await db
      .collection('partner_campaigns')
      .countDocuments({ partnerUserId: ownerObjectId, isDemoData: true });
    if (existingCampaigns === 0) {
      await db.collection('partner_campaigns').insertMany([
        {
          partnerUserId: ownerObjectId,
          title: 'Grand Opening Promo',
          body: "We're now on Lunara! Book your first wash and get 10% off with code " + promoCode,
          recipientCount: 120,
          sentCount: 118,
          isDemoData: true,
          createdAt: new Date(now.getTime() - 5 * 86400000),
          updatedAt: new Date(now.getTime() - 5 * 86400000),
        },
        {
          partnerUserId: ownerObjectId,
          title: 'Weekend Wash Discount',
          body: 'Drop off this weekend and skip the delivery fee on orders over ₱500.',
          recipientCount: 85,
          sentCount: 85,
          isDemoData: true,
          createdAt: new Date(now.getTime() - 2 * 86400000),
          updatedAt: new Date(now.getTime() - 2 * 86400000),
        },
      ]);
    }

    // ── Communications: partner<->admin conversation + notifications ───────
    const existingConversation = await db
      .collection('conversations')
      .findOne({ partnerId: ownerObjectId });
    let conversationId = existingConversation?._id;
    if (!conversationId) {
      const inserted = await db.collection('conversations').insertOne({
        partnerId: ownerObjectId,
        subject: 'Welcome to Lunara',
        lastMessageId: null,
        partnerUnread: 1,
        adminUnread: 0,
        isDemoData: true,
        createdAt: new Date(now.getTime() - 4 * 86400000),
        updatedAt: now,
      });
      conversationId = inserted.insertedId;

      const messages = [
        {
          conversationId,
          senderId: null,
          senderRole: 'admin',
          senderName: 'Lunara Support',
          content: "Welcome aboard! Let us know if you need help getting your first orders set up.",
          attachments: [],
          readAt: new Date(now.getTime() - 4 * 86400000 + 3600000),
          isDemoData: true,
          createdAt: new Date(now.getTime() - 4 * 86400000),
          updatedAt: new Date(now.getTime() - 4 * 86400000),
        },
        {
          conversationId,
          senderId: ownerObjectId,
          senderRole: 'partner',
          senderName: branch.name,
          content: 'Thanks! Quick question — how do I add my staff accounts?',
          attachments: [],
          readAt: new Date(now.getTime() - 3 * 86400000 + 1800000),
          isDemoData: true,
          createdAt: new Date(now.getTime() - 3 * 86400000),
          updatedAt: new Date(now.getTime() - 3 * 86400000),
        },
        {
          conversationId,
          senderId: null,
          senderRole: 'admin',
          senderName: 'Lunara Support',
          content: "You can invite staff from Settings > Staff. They'll get their own login once added.",
          attachments: [],
          readAt: null,
          isDemoData: true,
          createdAt: new Date(now.getTime() - 3 * 86400000 + 900000),
          updatedAt: new Date(now.getTime() - 3 * 86400000 + 900000),
        },
      ];
      const insertedMessages = await db.collection('messages').insertMany(messages);
      const lastMessageId = insertedMessages.insertedIds[messages.length - 1];
      await db
        .collection('conversations')
        .updateOne({ _id: conversationId }, { $set: { lastMessageId, updatedAt: now } });
    }

    const existingNotifications = await db
      .collection('notifications')
      .countDocuments({ userId: ownerObjectId, isDemoData: true });
    if (existingNotifications === 0) {
      await db.collection('notifications').insertMany([
        {
          userId: ownerObjectId,
          title: 'New order received',
          body: 'A new wash & fold order was just booked.',
          channel: 'in_app',
          read: false,
          data: {},
          isDemoData: true,
          expiresAt: new Date(now.getTime() + 90 * 86400000),
          createdAt: new Date(now.getTime() - 3600000),
          updatedAt: new Date(now.getTime() - 3600000),
        },
        {
          userId: ownerObjectId,
          title: 'Low stock alert',
          body: 'Laundry Bags are running low (8 left).',
          channel: 'in_app',
          read: false,
          data: { sku: 'BAG-001' },
          isDemoData: true,
          expiresAt: new Date(now.getTime() + 90 * 86400000),
          createdAt: new Date(now.getTime() - 7200000),
          updatedAt: new Date(now.getTime() - 7200000),
        },
        {
          userId: ownerObjectId,
          title: 'Payout processed',
          body: 'Your latest settlement payout has been sent.',
          channel: 'in_app',
          read: true,
          data: {},
          isDemoData: true,
          expiresAt: new Date(now.getTime() + 30 * 86400000),
          createdAt: new Date(now.getTime() - 2 * 86400000),
          updatedAt: new Date(now.getTime() - 2 * 86400000),
        },
      ]);
    }

    // ── Orders (10) — one full day-to-day pipeline, pickup through completion ──
    const existingDemoOrders = await db
      .collection('orders')
      .countDocuments({ branchId: branchObjectId, isDemoData: true });
    if (existingDemoOrders === 0) {
      const ledgerEntries: Record<string, unknown>[] = [];

      for (let i = 0; i < DEMO_ORDER_PIPELINE.length; i++) {
        const spec = DEMO_ORDER_PIPELINE[i];
        const customerId = customerUserIds[i];
        const addressId = customerAddressIds[i].toString();
        const scheduledPickupAt = new Date(now.getTime() - spec.daysAgo * 86400000);
        const subtotal = spec.quantity * spec.unitPrice;
        const deliveryFee = spec.fulfillmentType === 'delivery' ? 50 : 0;
        const total = subtotal + deliveryFee;
        const idx = stageIndex(spec.status);

        const pickup: Record<string, unknown> = {};
        const shopReceiving: Record<string, unknown> = {};
        const delivery: Record<string, unknown> = {};

        if (idx >= stageIndex('rider_assigned_pickup')) {
          pickup.offeredAt = scheduledPickupAt;
          pickup.acceptedAt = scheduledPickupAt;
        }
        if (idx >= stageIndex('picked_up')) {
          pickup.collectedAt = scheduledPickupAt;
          pickup.actualLoadCount = spec.quantity;
        }
        if (idx >= stageIndex('received_at_shop')) {
          shopReceiving.receivedAt = scheduledPickupAt;
          shopReceiving.itemCount = spec.quantity;
          shopReceiving.confirmedBy = 'Sample Staff';
        }
        if (idx >= stageIndex('ready_for_delivery') && spec.fulfillmentType === 'delivery') {
          delivery.offeredAt = scheduledPickupAt;
        }
        if (idx >= stageIndex('rider_assigned_delivery') && spec.fulfillmentType === 'delivery') {
          delivery.acceptedAt = scheduledPickupAt;
        }
        if (idx >= stageIndex('out_for_delivery') && spec.fulfillmentType === 'delivery') {
          delivery.outForDeliveryAt = scheduledPickupAt;
        }
        if (spec.status === 'completed') {
          delivery.deliveredAt = scheduledPickupAt;
          delivery.customerReceivedAt = scheduledPickupAt;
        }

        const statusHistory = PIPELINE_ORDER.slice(0, idx + 1).map((status, historyIdx) => ({
          status,
          timestamp: new Date(scheduledPickupAt.getTime() + historyIdx * 3600000),
        }));

        const orderResult = await db.collection('orders').insertOne({
          customerId,
          partnerId: partner?._id,
          branchId: branchObjectId,
          branchCode: branch.code,
          branchName: branch.name,
          bookingType: spec.bookingType,
          items: [{ serviceType: spec.bookingType, quantity: spec.quantity, unitPrice: spec.unitPrice }],
          addons: [],
          pickupAddressId: addressId,
          deliveryAddressId: addressId,
          fulfillmentType: spec.fulfillmentType,
          scheduledPickupAt,
          pickupRiderId: idx >= stageIndex('rider_assigned_pickup') ? riderUser!._id : undefined,
          deliveryRiderId: idx >= stageIndex('rider_assigned_delivery') ? riderUser!._id : undefined,
          pickup,
          shopReceiving,
          delivery,
          status: spec.status,
          subtotal,
          deliveryFee,
          discount: 0,
          total,
          pricingMode: 'flat_bag',
          requiresDeliveryApproval: false,
          statusHistory,
          isDemoData: true,
          createdAt: scheduledPickupAt,
          updatedAt: now,
        });

        // Recognize revenue for the one fully closed-out order — a balanced double-entry pair per
        // the ledger's ({accountType, direction, amount}) contract: platform fee + partner payout
        // together equal the order total collected.
        if (spec.status === 'completed') {
          const platformFee = Math.round(total * 0.2);
          const partnerPayout = total - platformFee;
          const transactionRef = `demo-order-${orderResult.insertedId.toString()}`;
          ledgerEntries.push(
            {
              transactionRef,
              accountType: 'order_revenue_clearing',
              accountSubject: ownerUserId,
              direction: 'credit',
              amount: total,
              description: `Order ${orderResult.insertedId.toString()} collected`,
              sourceType: 'settlement',
              sourceId: orderResult.insertedId.toString(),
              isDemoData: true,
              createdAt: scheduledPickupAt,
              updatedAt: scheduledPickupAt,
            },
            {
              transactionRef,
              accountType: 'partner_payable',
              accountSubject: ownerUserId,
              direction: 'debit',
              amount: partnerPayout,
              description: `Partner payout for order ${orderResult.insertedId.toString()}`,
              sourceType: 'settlement',
              sourceId: orderResult.insertedId.toString(),
              isDemoData: true,
              createdAt: scheduledPickupAt,
              updatedAt: scheduledPickupAt,
            },
            {
              transactionRef,
              accountType: 'platform_revenue',
              accountSubject: 'platform',
              direction: 'debit',
              amount: platformFee,
              description: `Platform fee for order ${orderResult.insertedId.toString()}`,
              sourceType: 'settlement',
              sourceId: orderResult.insertedId.toString(),
              isDemoData: true,
              createdAt: scheduledPickupAt,
              updatedAt: scheduledPickupAt,
            },
          );
        }
      }

      if (ledgerEntries.length > 0) {
        await db.collection('ledger_entries').insertMany(ledgerEntries);
      }
    }

    await users.updateOne({ _id: ownerObjectId }, { $set: { hasDemoData: true, updatedAt: now } });
    this.logger.log(`Seeded demo data for partner ${ownerUserId}`);
  }

  async clearDemoData(ownerUserId: string): Promise<void> {
    const db = this.connection.db!;
    const users = db.collection('users');
    const ownerObjectId = new Types.ObjectId(ownerUserId);

    const demoCustomerEmails = DEMO_CUSTOMERS.map((_, i) => this.demoCustomerEmail(ownerUserId, i + 1));
    const riderEmail = this.demoRiderEmail(ownerUserId);
    const demoStaffEmails = DEMO_STAFF.map((_, i) => this.demoStaffEmail(ownerUserId, i + 1));

    const demoCustomers = await users.find({ email: { $in: demoCustomerEmails } }).toArray();
    const demoCustomerIds = demoCustomers.map((c) => c._id);

    const { deletedCount } = await db
      .collection('orders')
      .deleteMany({ isDemoData: true, customerId: { $in: demoCustomerIds } });
    this.logger.log(`Deleted ${deletedCount} demo orders for partner ${ownerUserId}`);

    await db.collection('addresses').deleteMany({ userId: { $in: demoCustomerIds } });
    await db.collection('customers').deleteMany({ userId: { $in: demoCustomerIds } });

    const demoRider = await users.findOne({ email: riderEmail });
    if (demoRider) {
      await db.collection('riders').deleteMany({ userId: demoRider._id });
    }

    const branches = await db.collection('branches').find({ partnerUserId: ownerObjectId }).toArray();
    const branchIds = branches.map((b) => b._id);
    if (branchIds.length > 0) {
      await db.collection('shop_inventory').deleteMany({ branchId: { $in: branchIds }, isDemoData: true });
    }
    await db.collection('ledger_entries').deleteMany({ accountSubject: ownerUserId, isDemoData: true });
    await db.collection('promotions').deleteMany({ partnerUserId: ownerObjectId, isDemoData: true });
    await db.collection('partner_campaigns').deleteMany({ partnerUserId: ownerObjectId, isDemoData: true });

    const conversation = await db.collection('conversations').findOne({ partnerId: ownerObjectId, isDemoData: true });
    if (conversation) {
      await db.collection('messages').deleteMany({ conversationId: conversation._id });
      await db.collection('conversations').deleteOne({ _id: conversation._id });
    }
    await db.collection('notifications').deleteMany({ userId: ownerObjectId, isDemoData: true });

    await users.deleteMany({ email: { $in: [...demoCustomerEmails, riderEmail, ...demoStaffEmails] } });
    await users.updateOne({ _id: ownerObjectId }, { $set: { hasDemoData: false, updatedAt: new Date() } });
    this.logger.log(`Cleared demo data for partner ${ownerUserId}`);
  }
}
