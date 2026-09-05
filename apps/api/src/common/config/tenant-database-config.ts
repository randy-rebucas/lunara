import { getMongoUri } from './database-config';

/**
 * Builds the connection URI for a branded/territorial partner's dedicated database, reusing the
 * same cluster/credentials as the shared connection but swapping the database name segment.
 * `mongodb://host/db?opts` and `mongodb+srv://host/db?opts` are both handled — the database name
 * is always the path segment between the last `/` before `?` and the query string (or end).
 */
export function buildTenantMongoUri(dbName: string): string {
  const baseUri = getMongoUri();
  const [beforeQuery, query] = baseUri.split('?');
  const lastSlash = beforeQuery.lastIndexOf('/');
  if (lastSlash === -1) {
    throw new Error(`Cannot derive tenant database name from MONGODB_URI: ${baseUri}`);
  }
  const withoutDb = beforeQuery.slice(0, lastSlash);
  const rebuilt = `${withoutDb}/${dbName}`;
  return query ? `${rebuilt}?${query}` : rebuilt;
}

/** Deterministic, DNS/collection-name-safe database name for a partner's dedicated database. */
export function tenantDatabaseName(partnerSlug: string): string {
  const safeSlug = partnerSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return `lunara_partner_${safeSlug}`;
}
