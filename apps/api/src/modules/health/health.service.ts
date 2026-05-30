import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { RedisService } from '../../common/redis/redis.service';

export type DependencyStatus = 'ok' | 'error';

export interface HealthCheckResult {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  checks: {
    mongo: DependencyStatus;
    redis: DependencyStatus;
  };
}

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<{ ok: boolean; data: HealthCheckResult }> {
    const [mongo, redis] = await Promise.all([this.checkMongo(), this.checkRedis()]);
    const ok = mongo === 'ok' && redis === 'ok';

    return {
      ok,
      data: {
        status: ok ? 'ok' : 'degraded',
        service: 'lunara-api',
        timestamp: new Date().toISOString(),
        checks: { mongo, redis },
      },
    };
  }

  private async checkMongo(): Promise<DependencyStatus> {
    try {
      if (this.mongo.readyState !== 1 || !this.mongo.db) return 'error';
      await this.mongo.db.admin().ping();
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }
}
