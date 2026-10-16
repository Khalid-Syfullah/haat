import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Permission, Prisma, Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { ArrayUnique, IsArray, IsBoolean, IsEmail, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Audit } from '../common/audit';
import { AuthUser, CurrentUser, effectivePermissions, Perm, Roles } from '../common/auth';
import { clamp, normalizePhone, toInt } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';

class CreateStaffDto {
  @IsString() @MinLength(2) @MaxLength(60) name: string;
  @IsString() phone: string;
  @IsOptional() @IsEmail() email?: string;
  /** Required for a new account; optional when promoting an existing customer. */
  @IsOptional() @IsString() @MinLength(8) @MaxLength(72) password?: string;
  @IsIn(['STAFF', 'ADMIN']) role: 'STAFF' | 'ADMIN';
  @IsArray() @ArrayUnique() @IsEnum(Permission, { each: true }) permissions: Permission[];
}

class UpdateStaffDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) name?: string;
  @IsOptional() @IsIn(['STAFF', 'ADMIN']) role?: 'STAFF' | 'ADMIN';
  @IsOptional() @IsArray() @ArrayUnique() @IsEnum(Permission, { each: true }) permissions?: Permission[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(72) password?: string;
}

export const PERMISSION_INFO: Record<Permission, { label: string; covers: string }> = {
  CATALOG: { label: 'Catalog', covers: 'Products, inventory, categories, brands, Excel import and export' },
  ORDERS: { label: 'Orders', covers: 'Orders, returns, customers and courier booking' },
  MARKETING: { label: 'Marketing', covers: 'Flash sales, vouchers and banners' },
  SUPPORT: { label: 'Support', covers: 'Support tickets, reviews and product questions' },
  REPORTS: { label: 'Reports', covers: 'Sales figures, reports and CSV exports' },
  SETTINGS: { label: 'Settings', covers: 'Store settings: delivery fees, COD rules, coins, alerts' },
};

const STAFF_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  role: true,
  permissions: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** Staff accounts and the audit log. Owners (ADMIN) only. */
@Roles(Role.ADMIN)
@Perm()
@Controller('admin')
export class AdminStaffController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('staff')
  async list() {
    const users = await this.prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.STAFF] } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: { ...STAFF_SELECT, _count: { select: { auditLogs: true } } },
    });
    const last = await this.prisma.auditLog.groupBy({
      by: ['actorId'],
      where: { actorId: { in: users.map((u) => u.id) } },
      _max: { createdAt: true },
    });
    const lastBy = new Map(last.map((l) => [l.actorId, l._max.createdAt]));
    return {
      items: users.map(({ _count, ...u }) => ({
        ...u,
        effectivePermissions: effectivePermissions(u),
        actions: _count.auditLogs,
        lastActionAt: lastBy.get(u.id) ?? null,
      })),
      permissions: Object.entries(PERMISSION_INFO).map(([key, v]) => ({ key, ...v })),
    };
  }

  @Audit({ action: 'staff.add', entity: 'staff', summary: ({ result }) => `Gave ${result?.name ?? ''} ${result?.role === 'ADMIN' ? 'owner' : 'staff'} access` })
  @Post('staff')
  async create(@Body() dto: CreateStaffDto) {
    const phone = normalizePhone(dto.phone);
    const email = dto.email?.toLowerCase().trim() || undefined;
    const permissions = dto.role === 'ADMIN' ? [] : dto.permissions;
    if (dto.role === 'STAFF' && !permissions.length) throw new BadRequestException('Pick at least one area this person can work in');
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing && existing.role !== Role.CUSTOMER) throw new BadRequestException('This phone number already has admin access');
    if (email) {
      const taken = await this.prisma.user.findFirst({ where: { email, NOT: existing ? { id: existing.id } : undefined } });
      if (taken) throw new BadRequestException('That email is already used by another account');
    }
    if (existing) {
      // Promote a customer account (the person keeps their order history)
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: dto.name.trim(),
          email: email ?? existing.email,
          role: dto.role,
          permissions,
          isActive: true,
          ...(dto.password ? { passwordHash: await hash(dto.password, 10) } : {}),
        },
        select: STAFF_SELECT,
      });
    }
    if (!dto.password) throw new BadRequestException('Set a password of at least 8 characters for the new account');
    return this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        phone,
        email,
        role: dto.role,
        permissions,
        passwordHash: await hash(dto.password, 10),
        cart: { create: {} },
      },
      select: STAFF_SELECT,
    });
  }

  @Audit({
    action: 'staff.update',
    entity: 'staff',
    summary: ({ body, result }) =>
      [
        body.permissions && `${result?.name}: access set to ${result?.role === 'ADMIN' ? 'everything' : (result?.permissions ?? []).join(', ').toLowerCase()}`,
        body.role && !body.permissions && `${result?.name} is now ${body.role === 'ADMIN' ? 'an owner' : 'staff'}`,
        body.isActive !== undefined && `${body.isActive ? 'Enabled' : 'Disabled'} ${result?.name}`,
        body.password && `Reset the password of ${result?.name}`,
        body.name && `Renamed staff member to ${result?.name}`,
      ]
        .filter(Boolean)
        .join('; ') || `Updated ${result?.name}`,
  })
  @Patch('staff/:id')
  async update(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: UpdateStaffDto) {
    const user = await this.prisma.user.findFirst({ where: { id, role: { in: [Role.ADMIN, Role.STAFF] } } });
    if (!user) throw new NotFoundException('Staff member not found');
    const role = dto.role ?? (user.role as 'ADMIN' | 'STAFF');
    if (id === me.id && (role !== 'ADMIN' || dto.isActive === false)) {
      throw new BadRequestException("You can't remove your own owner access. Ask another owner.");
    }
    if (user.role === Role.ADMIN && (role !== 'ADMIN' || dto.isActive === false)) await this.assertAnotherOwner(id);
    const permissions = role === 'ADMIN' ? [] : (dto.permissions ?? user.permissions);
    if (role === 'STAFF' && !permissions.length) throw new BadRequestException('Pick at least one area this person can work in');
    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        role,
        permissions,
        isActive: dto.isActive,
        ...(dto.password ? { passwordHash: await hash(dto.password, 10) } : {}),
      },
      select: STAFF_SELECT,
    });
  }

  /** Takes admin-panel access away; the account stays as a normal customer. */
  @Audit({ action: 'staff.remove', entity: 'staff', summary: ({ result }) => `Removed admin access from ${result?.name ?? ''}` })
  @Post('staff/:id/remove')
  async remove(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    if (id === me.id) throw new BadRequestException("You can't remove your own access. Ask another owner.");
    const user = await this.prisma.user.findFirst({ where: { id, role: { in: [Role.ADMIN, Role.STAFF] } } });
    if (!user) throw new NotFoundException('Staff member not found');
    if (user.role === Role.ADMIN) await this.assertAnotherOwner(id);
    await this.prisma.supportTicket.updateMany({ where: { assigneeId: id, status: { not: 'RESOLVED' } }, data: { assigneeId: null } });
    return this.prisma.user.update({ where: { id }, data: { role: Role.CUSTOMER, permissions: [] }, select: STAFF_SELECT });
  }

  private async assertAnotherOwner(exceptId: string) {
    const others = await this.prisma.user.count({ where: { role: Role.ADMIN, isActive: true, NOT: { id: exceptId } } });
    if (!others) throw new BadRequestException('The store needs at least one active owner');
  }

  // ───── Audit log ─────

  @Get('audit-log')
  async auditLog(@Query() query: Record<string, string>) {
    const page = clamp(toInt(query.page, 1), 1, 1000);
    const limit = 50;
    const where: Prisma.AuditLogWhereInput = {};
    if (query.actorId) where.actorId = query.actorId;
    if (query.entity) where.entity = query.entity;
    if (query.entityId) where.entityId = query.entityId;
    if (query.q) {
      where.OR = [
        { summary: { contains: query.q, mode: 'insensitive' } },
        { actorName: { contains: query.q, mode: 'insensitive' } },
        { action: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.from || query.to) {
      where.createdAt = {
        gte: query.from ? new Date(`${query.from}T00:00:00+06:00`) : undefined,
        lt: query.to ? new Date(new Date(`${query.to}T00:00:00+06:00`).getTime() + 86400000) : undefined,
      };
    }
    const [items, total, entities, actors] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({ by: ['entity'], _count: { _all: true }, orderBy: { entity: 'asc' } }),
      this.prisma.auditLog.groupBy({ by: ['actorId'], where: { actorId: { not: null } }, _count: { _all: true } }),
    ]);
    return {
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      entities: entities.filter((e) => e.entity).map((e) => ({ entity: e.entity, count: e._count._all })),
      // Grouped by person, named as they are called now (a rename doesn't split them)
      actors: await this.actorNames(actors.map((a) => ({ id: a.actorId!, count: a._count._all }))),
    };
  }

  private async actorNames(rows: { id: string; count: number }[]) {
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: { id: true, name: true } });
    const name = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({ ...r, name: name.get(r.id) ?? 'Removed account' })).sort((a, b) => a.name.localeCompare(b.name));
  }

  @Get('sms-log')
  async smsLog(@Query() query: Record<string, string>) {
    const page = clamp(toInt(query.page, 1), 1, 1000);
    const where: Prisma.SmsLogWhereInput = {};
    if (query.kind) where.kind = query.kind;
    if (query.q) where.phone = { contains: query.q.replace(/\D/g, '') };
    const [items, total] = await Promise.all([
      this.prisma.smsLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 50, take: 50 }),
      this.prisma.smsLog.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / 50)),
      provider: process.env.SMS_PROVIDER === 'sslwireless' ? 'sslwireless' : 'console',
    };
  }
}
