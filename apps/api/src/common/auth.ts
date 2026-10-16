import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Permission, Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export const AUTH_COOKIE = 'haat_token';

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  phone: string;
  permissions: Permission[];
}

const PUBLIC_KEY = 'isPublic';
const ROLES_KEY = 'roles';
const PERMS_KEY = 'permissions';

export const ALL_PERMISSIONS = Object.values(Permission);

/** Admins hold every permission; staff hold the ones on their account; customers none. */
export function effectivePermissions(user: Pick<AuthUser, 'role' | 'permissions'>): Permission[] {
  if (user.role === Role.ADMIN) return ALL_PERMISSIONS;
  if (user.role === Role.STAFF) return user.permissions;
  return [];
}

export const isStaff = (user?: Pick<AuthUser, 'role'>) => user?.role === Role.ADMIN || user?.role === Role.STAFF;

/** Route works without login; the user is still attached when a valid cookie is present. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Restrict a route or controller to these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
/**
 * Admin-panel access: owners always pass; staff pass when they hold any of these permissions.
 * With no arguments, any staff member passes (e.g. the dashboard).
 */
export const Perm = (...perms: Permission[]) => SetMetadata(PERMS_KEY, perms);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
});

export function readToken(req: Request): string | null {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
  if (cookie) return cookie;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export function setAuthCookie(res: Response, token: string) {
  const days = Number(process.env.JWT_EXPIRES_DAYS || 7);
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: days * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
}

/**
 * Global guard. Every route needs a logged-in user unless marked @Public().
 * @Roles(...) and @Perm(...) additionally check the user's role and staff permissions,
 * re-read from the database so a demoted or blocked account loses access immediately.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    const perms = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMS_KEY, [ctx.getHandler(), ctx.getClass()]);

    const token = readToken(req);
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, role: true, name: true, phone: true, isActive: true, permissions: true },
        });
        if (user?.isActive) req.user = { id: user.id, role: user.role, name: user.name, phone: user.phone, permissions: user.permissions };
      } catch {
        // invalid or expired token: treated as logged out
      }
    }

    if (isPublic && !roles?.length && !perms) return true;
    if (!req.user) throw new UnauthorizedException('Please log in to continue');
    if (roles?.length && !roles.includes(req.user.role)) throw new ForbiddenException('You do not have access to this');
    if (perms) {
      if (!isStaff(req.user)) throw new ForbiddenException('You do not have access to this');
      const mine = effectivePermissions(req.user);
      if (perms.length && !perms.some((p) => mine.includes(p))) {
        throw new ForbiddenException('Your staff account does not have access to this part of the admin panel');
      }
    }
    return true;
  }
}
