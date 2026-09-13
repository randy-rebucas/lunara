import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationDedupe, NotificationDedupeDocument } from './schemas/notification-dedupe.schema';

@Injectable()
export class NotificationDedupeService {
  constructor(
    @InjectModel(NotificationDedupe.name)
    private readonly dedupeModel: Model<NotificationDedupeDocument>,
  ) {}

  /**
   * Atomically claims `key` for `windowMs`. Returns true the first time (caller should proceed),
   * false if another call already holds an unexpired claim for this key (caller should skip) —
   * whether that call came from this process or another instance/pod, unlike a per-process
   * in-memory Map, which only catches duplicates within the same instance.
   *
   * The filter only matches a missing-or-expired doc, so this also re-claims immediately once a
   * window lapses rather than waiting on Mongo's (up to ~60s-delayed) TTL sweep to remove it.
   */
  async claim(key: string, windowMs: number): Promise<boolean> {
    const now = new Date();
    try {
      await this.dedupeModel.findOneAndUpdate(
        { key, expiresAt: { $lte: now } },
        { $set: { key, expiresAt: new Date(now.getTime() + windowMs) } },
        { upsert: true },
      );
      return true;
    } catch (err) {
      if (this.isDuplicateKeyError(err)) return false;
      throw err;
    }
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
  }
}
