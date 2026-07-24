import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

const REDACTED_KEYS = new Set(['password', 'newPassword', 'currentPassword', 'confirmPassword']);

function redact(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const entries = Object.entries(body as Record<string, unknown>).map(([key, value]) => [
    key,
    REDACTED_KEYS.has(key) ? '[redacted]' : value,
  ]);
  return Object.fromEntries(entries);
}

export interface RecordAuditLogInput {
  actorUserId: string;
  actorEmail: string;
  actorRole: string;
  method: string;
  path: string;
  action: string;
  statusCode: number;
  requestBody?: unknown;
  params?: unknown;
  ip?: string | null;
}

@Injectable()
export class AuditLogService {
  constructor(@InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>) {}

  async record(input: RecordAuditLogInput) {
    await this.auditLogModel.create({
      actorUserId: new Types.ObjectId(input.actorUserId),
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      method: input.method,
      path: input.path,
      action: input.action,
      statusCode: input.statusCode,
      requestBody: redact(input.requestBody),
      params: (input.params as Record<string, unknown>) ?? null,
      ip: input.ip ?? null,
    });
  }

  async list(query: {
    page?: number;
    limit?: number;
    search?: string;
    actorEmail?: string;
    action?: string;
    method?: string;
    from?: string;
    to?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));

    const filter: Record<string, unknown> = {};
    if (query.actorEmail) filter.actorEmail = query.actorEmail;
    if (query.action) filter.action = query.action;
    if (query.method) filter.method = query.method;
    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) createdAt.$gte = new Date(query.from);
      if (query.to) createdAt.$lte = new Date(query.to);
      filter.createdAt = createdAt;
    }
    if (query.search) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'i');
      filter.$or = [{ actorEmail: re }, { action: re }, { path: re }];
    }

    const [items, total, failedTotal, actorAgg, topActionAgg] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.auditLogModel.countDocuments(filter),
      this.auditLogModel.countDocuments({ ...filter, statusCode: { $gte: 400 } }),
      this.auditLogModel.distinct('actorEmail', filter),
      this.auditLogModel.aggregate<{ _id: string; count: number }>([
        { $match: filter },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
    ]);

    return {
      success: true,
      data: {
        items: items.map((log) => ({
          _id: log._id.toString(),
          actorUserId: log.actorUserId.toString(),
          actorEmail: log.actorEmail,
          actorRole: log.actorRole,
          method: log.method,
          path: log.path,
          action: log.action,
          statusCode: log.statusCode,
          requestBody: log.requestBody,
          params: log.params,
          ip: log.ip,
          createdAt: log.createdAt,
        })),
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        stats: {
          failedTotal,
          uniqueActors: actorAgg.length,
          topAction: topActionAgg[0] ? { action: topActionAgg[0]._id, count: topActionAgg[0].count } : null,
        },
      },
    };
  }

  /** Distinct HTTP methods for the admin filter chips. */
  async listMethods() {
    const methods = await this.auditLogModel.distinct('method');
    return { success: true, data: methods.sort() };
  }

  /** Distinct action labels for the admin filter dropdown. */
  async listActions() {
    const actions = await this.auditLogModel.distinct('action');
    return { success: true, data: actions.sort() };
  }
}
