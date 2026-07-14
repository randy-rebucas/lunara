const DEV_DEFAULT_MONGODB_URI = 'mongodb://localhost:27017/lunara';

export function getMongoUri(): string {
  return process.env.MONGODB_URI?.trim() || DEV_DEFAULT_MONGODB_URI;
}

export function assertProductionMongoUri(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.MONGODB_URI?.trim()) {
    throw new Error('MONGODB_URI must be set in production — refusing to fall back to localhost.');
  }
}

/**
 * Fail fast instead of hanging on Mongo's long default timeouts, and enable retryable
 * writes so a transient blip during a write doesn't surface as a hard error.
 */
export const mongoConnectionOptions = {
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
  retryWrites: true,
};
