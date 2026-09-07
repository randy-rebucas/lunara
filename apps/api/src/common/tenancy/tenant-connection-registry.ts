import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Connection, Model, Schema, Types } from 'mongoose';
import { Partner, PartnerDocument } from '../../modules/partners/schemas/partner.schema';
import { buildTenantMongoUri, tenantDatabaseName } from '../config/tenant-database-config';
import { mongoConnectionOptions } from '../config/database-config';

/**
 * Maintains one dedicated Mongoose `Connection` per branded/territorial partner (see
 * Partner.hasDedicatedDb). Regular shop partners have no entry here and callers should fall
 * back to the app's default (shared) connection. Connections are created lazily and cached for
 * the process lifetime; there's no eviction beyond `dropAndClose`, since the number of branded
 * partners is expected to stay small.
 */
@Injectable()
export class TenantConnectionRegistry implements OnModuleDestroy {
  private readonly logger = new Logger(TenantConnectionRegistry.name);
  private readonly connections = new Map<string, Connection>();
  private readonly modelCache = new Map<Connection, Map<string, Model<unknown>>>();

  constructor(@InjectModel(Partner.name) private readonly partnerModel: Model<PartnerDocument>) {}

  /** Returns the tenant's dedicated connection if one is provisioned, else undefined (caller
   * should use the default shared connection). Does not itself decide who gets a dedicated DB —
   * that's PartnerProvisioningService's job, reflected here via Partner.hasDedicatedDb. */
  async getConnection(partnerId: string): Promise<Connection | undefined> {
    const cached = this.connections.get(partnerId);
    if (cached) return cached;

    const partner = await this.partnerModel
      .findOne({ ownerUserId: new Types.ObjectId(partnerId) })
      .select('slug hasDedicatedDb')
      .lean();
    if (!partner?.hasDedicatedDb) return undefined;

    return this.openConnection(partnerId, partner.slug);
  }

  /** Opens (or returns the cached) connection for a partner known to have a dedicated DB.
   * Used by provisioning, which creates the connection before hasDedicatedDb is set. */
  async openConnection(partnerId: string, slug: string): Promise<Connection> {
    const cached = this.connections.get(partnerId);
    if (cached) return cached;

    const dbName = tenantDatabaseName(slug);
    const uri = buildTenantMongoUri(dbName);
    const connection = await mongoose.createConnection(uri, mongoConnectionOptions).asPromise();
    this.connections.set(partnerId, connection);
    this.logger.log(`Opened dedicated database connection for partner ${partnerId} (${dbName})`);
    return connection;
  }

  /** Memoized model accessor scoped to one connection, so repeated calls don't redefine models
   * (Mongoose throws OverwriteModelError on a second `connection.model(name, schema)` call). */
  getModel<T>(connection: Connection, name: string, schema: Schema<any>): Model<T> {
    let models = this.modelCache.get(connection);
    if (!models) {
      models = new Map();
      this.modelCache.set(connection, models);
    }
    const existing = models.get(name);
    if (existing) return existing as unknown as Model<T>;
    const model = connection.model(name, schema) as unknown as Model<T>;
    models.set(name, model as unknown as Model<unknown>);
    return model;
  }

  listActivePartnerIds(): string[] {
    return Array.from(this.connections.keys());
  }

  listActiveConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  /** Permanently drops a tenant's dedicated database and closes/evicts its connection. Callers
   * are responsible for taking a snapshot/backup beforehand — see PartnerProvisioningService. */
  async dropAndClose(partnerId: string): Promise<void> {
    const connection = this.connections.get(partnerId);
    if (!connection) return;
    await connection.dropDatabase();
    await connection.close();
    this.connections.delete(partnerId);
    this.modelCache.delete(connection);
    this.logger.log(`Dropped and closed dedicated database for partner ${partnerId}`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(Array.from(this.connections.values()).map((c) => c.close()));
  }
}
