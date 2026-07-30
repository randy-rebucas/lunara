import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ErrorLog, ErrorLogDocument } from './schemas/error-log.schema';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_STACK_LENGTH = 8000;

export interface RecordErrorLogInput {
  source: 'api' | 'admin-web' | 'customer-web' | 'partner-web';
  message: string;
  stack?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  userRole?: string;
  context?: Record<string, unknown> | null;
}

@Injectable()
export class ErrorLogService {
  private readonly logger = new Logger(ErrorLogService.name);

  constructor(@InjectModel(ErrorLog.name) private errorLogModel: Model<ErrorLogDocument>) {}

  /** Fire-and-forget — a failure to log an error must never mask or throw over the original error. */
  async record(input: RecordErrorLogInput) {
    try {
      await this.errorLogModel.create({
        source: input.source,
        message: input.message.slice(0, MAX_MESSAGE_LENGTH),
        stack: input.stack?.slice(0, MAX_STACK_LENGTH),
        path: input.path,
        method: input.method,
        statusCode: input.statusCode,
        userId: input.userId,
        userRole: input.userRole,
        context: input.context ?? null,
      });
    } catch (err) {
      this.logger.warn(`Failed to persist error log: ${(err as Error).message}`);
    }
  }

  async list(query: {
    page?: number;
    limit?: number;
    source?: string;
    search?: string;
    from?: string;
    to?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));

    const filter: Record<string, unknown> = {};
    if (query.source) filter.source = query.source;
    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) createdAt.$gte = new Date(query.from);
      if (query.to) createdAt.$lte = new Date(query.to);
      filter.createdAt = createdAt;
    }
    if (query.search) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'i');
      filter.$or = [{ message: re }, { path: re }];
    }

    const [items, total, bySourceAgg] = await Promise.all([
      this.errorLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.errorLogModel.countDocuments(filter),
      this.errorLogModel.aggregate<{ _id: string; count: number }>([
        { $match: filter },
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      success: true,
      data: {
        items: items.map((log) => ({
          _id: log._id.toString(),
          source: log.source,
          message: log.message,
          stack: log.stack,
          path: log.path,
          method: log.method,
          statusCode: log.statusCode,
          userId: log.userId,
          userRole: log.userRole,
          context: log.context,
          createdAt: log.createdAt,
        })),
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        bySource: Object.fromEntries(bySourceAgg.map((s) => [s._id, s.count])),
      },
    };
  }
}
