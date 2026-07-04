import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditLogService } from '../../modules/audit/audit-log.service';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

function deriveAction(method: string, path: string) {
  const segments = path
    .replace(/^\/api\/v1\/admin\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((seg) => (OBJECT_ID_RE.test(seg) ? ':id' : seg));
  return `${method.toLowerCase()}.admin.${segments.join('.') || 'root'}`;
}

/**
 * Records every mutating (POST/PATCH/PUT/DELETE) request under /admin as an audit log entry,
 * attributed to the authenticated admin. Registered globally (app.module.ts) so new admin
 * routes are captured automatically with no per-endpoint wiring.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method = req.method as string;
    const path = (req.originalUrl as string) ?? req.url;

    if (!MUTATING_METHODS.has(method) || !path.startsWith('/api/v1/admin')) {
      return next.handle();
    }

    const writeLog = (statusCode: number) => {
      const user = req.user as { sub?: string; email?: string; role?: string } | undefined;
      if (!user?.sub) return;
      this.auditLogService
        .record({
          actorUserId: user.sub,
          actorEmail: user.email ?? 'unknown',
          actorRole: user.role ?? 'unknown',
          method,
          path,
          action: deriveAction(method, path),
          statusCode,
          requestBody: req.body,
          params: req.params,
          ip: req.ip ?? null,
        })
        .catch((err) => this.logger.error(`Failed to record audit log for ${method} ${path}: ${err}`));
    };

    return next.handle().pipe(
      tap(() => writeLog(context.switchToHttp().getResponse().statusCode)),
      catchError((err) => {
        writeLog(err?.status ?? 500);
        return throwError(() => err);
      }),
    );
  }
}
