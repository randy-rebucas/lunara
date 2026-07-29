import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { getRedisUrl } from '../config/database-config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private lastErrorLogAt = 0;

  constructor() {
    const url = getRedisUrl();
    this.client = new Redis(url, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });
    this.client.on('error', (err) => {
      const now = Date.now();
      if (now - this.lastErrorLogAt < 10_000) return;
      this.lastErrorLogAt = now;
      this.logger.error(
        `Redis unavailable (${url}): ${err.message}. Start infrastructure: docker compose up -d`,
      );
    });
  }

  getClient() {
    return this.client;
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async ping() {
    return this.client.ping();
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
