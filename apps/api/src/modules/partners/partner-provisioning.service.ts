import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Model, Types } from 'mongoose';
import { Partner, PartnerDocument } from './schemas/partner.schema';
import { Order, OrderSchema, OrderDocument } from '../orders/schemas/order.schema';
import { Branch, BranchSchema, BranchDocument } from '../branches/schemas/branch.schema';
import { TenantConnectionRegistry } from '../../common/tenancy/tenant-connection-registry';
import { getMongoUri } from '../../common/config/database-config';
import { tenantDatabaseName } from '../../common/config/tenant-database-config';

const execFileAsync = promisify(execFile);

/**
 * Provisions and tears down dedicated databases for branded/territorial partners (Part C of the
 * multi-tenant hardening plan). Deliberately NOT auto-wired to fire on every brand-config save —
 * this is an explicit admin action (see partners-admin.controller.ts) because backfilling a
 * partner's live Orders/Branches into a new database is exactly the kind of hard-to-reverse,
 * data-moving operation that should never happen as a side effect of an unrelated edit (e.g.
 * tweaking brand colors also happens through updateBrandConfig).
 */
@Injectable()
export class PartnerProvisioningService {
  private readonly logger = new Logger(PartnerProvisioningService.name);

  constructor(
    @InjectModel(Partner.name) private readonly partnerModel: Model<PartnerDocument>,
    @InjectModel(Order.name) private readonly sharedOrderModel: Model<OrderDocument>,
    @InjectModel(Branch.name) private readonly sharedBranchModel: Model<BranchDocument>,
    private readonly registry: TenantConnectionRegistry,
  ) {}

  /**
   * Creates the partner's dedicated database, backfills their existing Orders and Branches into
   * it, and marks the shared-DB copies archived (soft-delete, not removed — deletion is a
   * separate, later cleanup once the migration is verified). Sets Partner.hasDedicatedDb = true
   * only after the backfill's document counts are confirmed to match.
   */
  async provision(partnerId: string): Promise<{ ordersMigrated: number; branchesMigrated: number }> {
    const partner = await this.partnerModel.findOne({ ownerUserId: new Types.ObjectId(partnerId) });
    if (!partner) throw new BadRequestException('No Partner brand record for this owner');
    if (partner.hasDedicatedDb) {
      throw new BadRequestException('This partner already has a dedicated database');
    }

    const connection = await this.registry.openConnection(partnerId, partner.slug);
    const tenantOrderModel = this.registry.getModel<OrderDocument>(connection, Order.name, OrderSchema);
    const tenantBranchModel = this.registry.getModel<BranchDocument>(connection, Branch.name, BranchSchema);

    const ownerId = new Types.ObjectId(partnerId);

    const orders = await this.sharedOrderModel.find({ partnerId: ownerId, archivedAt: { $exists: false } }).lean();
    if (orders.length > 0) {
      await tenantOrderModel.insertMany(orders, { ordered: false });
    }
    const branches = await this.sharedBranchModel
      .find({ partnerUserId: ownerId, archivedAt: { $exists: false } })
      .lean();
    if (branches.length > 0) {
      await tenantBranchModel.insertMany(branches, { ordered: false });
    }

    const [tenantOrderCount, tenantBranchCount] = await Promise.all([
      tenantOrderModel.countDocuments({ partnerId: ownerId }),
      tenantBranchModel.countDocuments({ partnerUserId: ownerId }),
    ]);
    if (tenantOrderCount !== orders.length || tenantBranchCount !== branches.length) {
      throw new Error(
        `Backfill count mismatch for partner ${partnerId}: orders ${tenantOrderCount}/${orders.length}, ` +
          `branches ${tenantBranchCount}/${branches.length}. Dedicated DB left unmarked — investigate before retrying.`,
      );
    }

    // Soft-archive the shared-DB copies rather than deleting — actual deletion is a separate,
    // manually-triggered cleanup step once the migration has been verified in production.
    await this.sharedOrderModel.updateMany({ partnerId: ownerId }, { $set: { archivedAt: new Date() } });
    await this.sharedBranchModel.updateMany({ partnerUserId: ownerId }, { $set: { archivedAt: new Date() } });

    partner.hasDedicatedDb = true;
    await partner.save();

    this.logger.log(
      `Provisioned dedicated database for partner ${partnerId}: ${orders.length} orders, ${branches.length} branches migrated`,
    );
    return { ordersMigrated: orders.length, branchesMigrated: branches.length };
  }

  /**
   * Snapshots the partner's dedicated database via `mongodump` before dropping it — the actual
   * "archive on unsubscribe" goal. Requires the `mongodump` CLI to be on PATH; throws (rather
   * than silently skipping the backup) if it's unavailable, since dropping without a snapshot
   * would be irreversible data loss.
   */
  async archiveAndTeardown(partnerId: string, outDir: string): Promise<void> {
    const partner = await this.partnerModel.findOne({ ownerUserId: new Types.ObjectId(partnerId) });
    if (!partner?.hasDedicatedDb) {
      throw new BadRequestException('This partner has no dedicated database to archive');
    }

    const dbName = tenantDatabaseName(partner.slug);
    const uri = getMongoUri();
    try {
      await execFileAsync('mongodump', [
        `--uri=${uri.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`)}`,
        `--out=${outDir}`,
      ]);
    } catch (err) {
      throw new Error(
        `mongodump snapshot failed for partner ${partnerId} — refusing to drop the database without a backup: ${err}`,
      );
    }

    await this.registry.dropAndClose(partnerId);
    partner.hasDedicatedDb = false;
    await partner.save();
    this.logger.log(`Archived and dropped dedicated database for partner ${partnerId} (snapshot: ${outDir})`);
  }
}
