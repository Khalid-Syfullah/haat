import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, isStaff } from './auth';

const AUDIT_KEY = 'audit';
const SKIP_AUDIT_KEY = 'skipAudit';

export interface AuditMeta {
  action: string;
  entity?: string;
  /** Short human summary. Gets the request body, route params and the handler's result. */
  summary?: (ctx: { body: any; params: Record<string, string>; result: any }) => string;
}

/** Names an admin action for the audit log. Without it, a generic label is derived from the route. */
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);
/** For admin POSTs that change nothing worth logging (previews, test runs). */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);

const SECRET = /pass(word)?|secret|token|hash/i;

/** Copy of the request body that is safe and small enough to keep. */
export function auditData(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  if (typeof value !== 'object') return value;
  if (depth > 3) return '…';
  if (Array.isArray(value)) {
    if (value.length > 15) return `${value.length} items`;
    return value.map((v) => auditData(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET.test(k) ? '[hidden]' : auditData(v, depth + 1);
  }
  return out;
}

/** A label a person can recognise the record by, taken from what the handler returned. */
function labelOf(result: any): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  for (const key of ['orderNo', 'ticketNo', 'code', 'sku', 'title', 'name', 'phone']) {
    if (typeof result[key] === 'string' && result[key]) return result[key];
  }
  return undefined;
}

const VERB: Record<string, string> = { POST: 'Created', PUT: 'Updated', PATCH: 'Updated', DELETE: 'Deleted' };

/**
 * Writes one AuditLog row for every successful non-GET request a staff member makes under /api/admin
 * (and any other route marked @Audit). Logging never blocks or fails the request itself.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(AUDIT_KEY, [ctx.getHandler(), ctx.getClass()]);
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [ctx.getHandler(), ctx.getClass()]);
    const path = (req.originalUrl || req.url).split('?')[0];
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (skip || !mutating || !isStaff(req.user) || (!meta && !path.startsWith('/api/admin/'))) return next.handle();

    const user = req.user!;
    return next.handle().pipe(
      tap((result) => {
        void this.write(req, user, path, meta, ctx, result);
      }),
    );
  }

  private async write(req: Request, user: AuthUser, path: string, meta: AuditMeta | undefined, ctx: ExecutionContext, result: unknown) {
    try {
      const params = (req.params ?? {}) as Record<string, string>;
      // /api/admin/orders/:id/transition → entity "order"
      const segment = path.replace(/^\/api\/admin\//, '').split('/')[0] ?? '';
      const entity = meta?.entity ?? (segment.replace(/-/g, '_').replace(/ies$/, 'y').replace(/s$/, '') || null);
      const action = meta?.action ?? `${entity ?? 'admin'}.${ctx.getHandler().name}`;
      const entityId = params.id ?? params.variantId ?? (result && typeof result === 'object' ? ((result as any).id as string) : undefined) ?? null;
      let summary: string;
      if (meta?.summary) {
        summary = meta.summary({ body: req.body ?? {}, params, result });
      } else {
        const label = labelOf(result);
        summary = `${VERB[req.method] ?? req.method} ${entity?.replace(/_/g, ' ') ?? 'record'}${label ? ` ${label}` : ''}`;
      }
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          action,
          entity,
          entityId: typeof entityId === 'string' ? entityId : null,
          summary: summary.slice(0, 300),
          method: req.method,
          path,
          data: (auditData(req.body) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          ip: req.ip,
        },
      });
    } catch (err) {
      this.logger.warn(`Could not write audit entry for ${req.method} ${path}: ${String(err)}`);
    }
  }
}
