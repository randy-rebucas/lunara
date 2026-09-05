import { Connection, FilterQuery, Model, Schema } from 'mongoose';
import { TenantConnectionRegistry } from './tenant-connection-registry';

/**
 * Runs the same find query against the default (shared) connection's model plus every
 * currently-provisioned tenant connection, merging results in application code. For admin-web's
 * cross-partner views (dispatch queue, aggregate reporting) once some branded partners have moved
 * to a dedicated database and are no longer visible to a plain query against the shared model.
 *
 * Known limitation: pagination/sorting across the merged set happens in-memory here, not at the
 * database level — fine while the number of branded partners stays small (per the plan), but
 * worth revisiting (e.g. a synced reporting store) if that count grows large.
 */
export async function queryAcrossTenants<T>(
  registry: TenantConnectionRegistry,
  sharedModel: Model<T>,
  modelName: string,
  schema: Schema<any>,
  filter: FilterQuery<T>,
): Promise<T[]> {
  const sharedResults = await sharedModel.find(filter).lean<T[]>();

  const tenantConnections = registry.listActiveConnections();
  const tenantResults = await Promise.all(
    tenantConnections.map((connection: Connection) => {
      const model = registry.getModel<T>(connection, modelName, schema);
      return model.find(filter).lean<T[]>();
    }),
  );

  return [...sharedResults, ...tenantResults.flat()];
}
