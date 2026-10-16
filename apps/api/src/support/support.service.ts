import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { randomInt } from 'crypto';
import { AuthUser, effectivePermissions, isStaff } from '../common/auth';
import { EngagementService } from '../common/engagement.service';
import { SettingsService } from '../common/settings.service';
import { SmsService } from '../common/sms.service';
import { clamp, dhakaDay, toInt } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ORDER_ISSUE: 'Problem with an order',
  DELIVERY: 'Delivery',
  PAYMENT: 'Payment or refund',
  RETURN_REFUND: 'Return',
  PRODUCT: 'Question about a product',
  ACCOUNT: 'My account',
  OTHER: 'Something else',
};

const IMAGE = /^\/uploads\/[\w.-]+$/;

function cleanImages(images?: string[]) {
  const list = (images ?? []).slice(0, 5);
  if (list.some((i) => !IMAGE.test(i))) throw new BadRequestException('Attach photos with the upload button');
  return list;
}

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engagement: EngagementService,
    private readonly settings: SettingsService,
    private readonly sms: SmsService,
  ) {}

  private async newTicketNo() {
    const day = dhakaDay().replace(/-/g, '').slice(2);
    for (let i = 0; i < 5; i++) {
      const no = `T${day}${randomInt(1000, 9999)}`;
      if (!(await this.prisma.supportTicket.findUnique({ where: { ticketNo: no } }))) return no;
    }
    return `T${day}${randomInt(100000, 999999)}`;
  }

  // ───── Customer side ─────

  async create(user: AuthUser, input: { orderNo?: string; category: TicketCategory; subject: string; message: string; images?: string[] }) {
    let orderId: string | undefined;
    if (input.orderNo) {
      const order = await this.prisma.order.findFirst({ where: { orderNo: input.orderNo, userId: user.id }, select: { id: true } });
      if (!order) throw new BadRequestException('That order is not on your account');
      orderId = order.id;
    }
    const open = await this.prisma.supportTicket.count({ where: { userId: user.id, status: { not: 'RESOLVED' } } });
    if (open >= 10) throw new BadRequestException('You have 10 open requests. Reply to one of those, or wait until we resolve them.');
    const images = cleanImages(input.images);
    const ticketNo = await this.newTicketNo();
    return this.prisma.supportTicket.create({
      data: {
        ticketNo,
        userId: user.id,
        orderId,
        category: input.category,
        subject: input.subject.trim(),
        // Delivery and payment problems on a live order jump the queue.
        priority: orderId && ['ORDER_ISSUE', 'DELIVERY', 'PAYMENT'].includes(input.category) ? 'HIGH' : 'NORMAL',
        messages: { create: { authorId: user.id, fromStaff: false, body: input.message.trim(), images } },
      },
      select: { id: true, ticketNo: true, status: true },
    });
  }

  async listMine(userId: string) {
    const rows = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        order: { select: { orderNo: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, fromStaff: true, createdAt: true } },
      },
    });
    return rows.map((t) => ({
      ticketNo: t.ticketNo,
      subject: t.subject,
      category: t.category,
      categoryLabel: CATEGORY_LABELS[t.category],
      status: t.status,
      orderNo: t.order?.orderNo ?? null,
      lastMessageAt: t.lastMessageAt,
      createdAt: t.createdAt,
      last: t.messages[0] ? { body: t.messages[0].body.slice(0, 140), fromStaff: t.messages[0].fromStaff, createdAt: t.messages[0].createdAt } : null,
    }));
  }

  async getMine(userId: string, ticketNo: string) {
    const t = await this.prisma.supportTicket.findFirst({
      where: { ticketNo, userId },
      include: {
        order: { select: { orderNo: true, status: true, total: true, createdAt: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { name: true } } } },
      },
    });
    if (!t) throw new NotFoundException('Request not found');
    const store = (await this.settings.get()).store.name;
    return {
      ticketNo: t.ticketNo,
      subject: t.subject,
      category: t.category,
      categoryLabel: CATEGORY_LABELS[t.category],
      status: t.status,
      order: t.order,
      createdAt: t.createdAt,
      resolvedAt: t.resolvedAt,
      messages: t.messages.map((m) => ({
        id: m.id,
        fromStaff: m.fromStaff,
        // Customers see the first name of the person helping them
        author: m.fromStaff ? `${m.author.name.split(/\s+/)[0]}, ${store} support` : 'You',
        body: m.body,
        images: m.images,
        createdAt: m.createdAt,
      })),
    };
  }

  async customerReply(user: AuthUser, ticketNo: string, body: string, images?: string[]) {
    const t = await this.prisma.supportTicket.findFirst({ where: { ticketNo, userId: user.id } });
    if (!t) throw new NotFoundException('Request not found');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.ticketMessage.create({ data: { ticketId: t.id, authorId: user.id, fromStaff: false, body: body.trim(), images: cleanImages(images) } }),
      // A reply reopens a resolved request.
      this.prisma.supportTicket.update({ where: { id: t.id }, data: { status: 'OPEN', lastMessageAt: now, resolvedAt: null } }),
    ]);
    return this.getMine(user.id, ticketNo);
  }

  async customerResolve(userId: string, ticketNo: string) {
    const t = await this.prisma.supportTicket.findFirst({ where: { ticketNo, userId } });
    if (!t) throw new NotFoundException('Request not found');
    await this.prisma.supportTicket.update({ where: { id: t.id }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
    return this.getMine(userId, ticketNo);
  }

  // ───── Staff side ─────

  async adminList(me: AuthUser, q: Record<string, string>) {
    const page = clamp(toInt(q.page, 1), 1, 1000);
    const where: Prisma.SupportTicketWhereInput = {};
    if (q.status && q.status in TicketStatus) where.status = q.status as TicketStatus;
    if (q.assignee === 'me') where.assigneeId = me.id;
    else if (q.assignee === 'none') where.assigneeId = null;
    else if (q.assignee) where.assigneeId = q.assignee;
    if (q.category && q.category in TicketCategory) where.category = q.category as TicketCategory;
    if (q.q) {
      const term = q.q.trim();
      where.OR = [
        { ticketNo: { contains: term, mode: 'insensitive' } },
        { subject: { contains: term, mode: 'insensitive' } },
        { user: { phone: { contains: term } } },
        { user: { name: { contains: term, mode: 'insensitive' } } },
        { order: { orderNo: { contains: term, mode: 'insensitive' } } },
      ];
    }
    const [rows, total, counts, mineOpen] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        // Waiting on us first, high priority first, oldest wait first
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { lastMessageAt: 'asc' }],
        skip: (page - 1) * 25,
        take: 25,
        include: {
          user: { select: { name: true, phone: true } },
          assignee: { select: { id: true, name: true } },
          order: { select: { id: true, orderNo: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { fromStaff: true, body: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.supportTicket.count({ where: { assigneeId: me.id, status: 'OPEN' } }),
    ]);
    return {
      items: rows.map(({ _count, messages, ...t }) => ({
        id: t.id,
        ticketNo: t.ticketNo,
        subject: t.subject,
        category: t.category,
        categoryLabel: CATEGORY_LABELS[t.category],
        status: t.status,
        priority: t.priority,
        customer: t.user,
        assignee: t.assignee,
        order: t.order,
        messages: _count.messages,
        lastFromStaff: messages[0]?.fromStaff ?? false,
        preview: messages[0]?.body.slice(0, 120) ?? '',
        lastMessageAt: t.lastMessageAt,
        createdAt: t.createdAt,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / 25)),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      mineOpen,
      categories: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    };
  }

  async adminGet(id: string) {
    const t = await this.prisma.supportTicket.findFirst({
      where: { OR: [{ id }, { ticketNo: id }] },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, createdAt: true, codBlocked: true } },
        assignee: { select: { id: true, name: true } },
        order: { select: { id: true, orderNo: true, status: true, paymentMethod: true, paymentStatus: true, total: true, createdAt: true, courier: true, trackingNo: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true } } } },
      },
    });
    if (!t) throw new NotFoundException('Ticket not found');
    const [otherTickets, recentOrders, staff] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: { userId: t.userId, NOT: { id: t.id } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, ticketNo: true, subject: true, status: true, createdAt: true },
      }),
      this.prisma.order.findMany({
        where: { userId: t.userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, orderNo: true, status: true, total: true, createdAt: true },
      }),
      this.assignableStaff(),
    ]);
    return { ...t, categoryLabel: CATEGORY_LABELS[t.category], otherTickets, recentOrders, staff };
  }

  /** Owners, and staff who can work on support. */
  async assignableStaff() {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, OR: [{ role: 'ADMIN' }, { role: 'STAFF', permissions: { has: 'SUPPORT' } }] },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, role: true },
    });
    return users;
  }

  async staffReply(me: AuthUser, id: string, input: { body: string; images?: string[]; status?: 'PENDING' | 'RESOLVED' }) {
    const t = await this.prisma.supportTicket.findFirst({ where: { OR: [{ id }, { ticketNo: id }] }, include: { user: { select: { phone: true, marketingSms: true } } } });
    if (!t) throw new NotFoundException('Ticket not found');
    const status: TicketStatus = input.status ?? 'PENDING';
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.ticketMessage.create({ data: { ticketId: t.id, authorId: me.id, fromStaff: true, body: input.body.trim(), images: cleanImages(input.images) } });
      await tx.supportTicket.update({
        where: { id: t.id },
        data: {
          status,
          lastMessageAt: now,
          resolvedAt: status === 'RESOLVED' ? now : null,
          // Whoever answers an unassigned ticket takes it
          assigneeId: t.assigneeId ?? me.id,
        },
      });
      await this.engagement.notify(tx, t.userId, {
        type: 'support',
        title: status === 'RESOLVED' ? 'We resolved your request' : 'We replied to your request',
        body: `${t.subject} (${t.ticketNo})`,
        link: `/account/support/${t.ticketNo}`,
      });
    });
    const settings = await this.settings.get();
    if (settings.support.smsOnReply) {
      // Replies to a request the customer opened are service messages, not marketing.
      const web = (process.env.WEB_URL || 'http://localhost:3000').replace(/\/+$/, '');
      await this.sms.send(t.user.phone, `${settings.store.name}: we replied to your request ${t.ticketNo}. ${web}/account/support/${t.ticketNo}`, 'ticket', t.userId);
    }
    return this.adminGet(t.id);
  }

  async staffUpdate(me: AuthUser, id: string, input: { status?: TicketStatus; assigneeId?: string | null; priority?: TicketPriority }) {
    const t = await this.prisma.supportTicket.findFirst({ where: { OR: [{ id }, { ticketNo: id }] } });
    if (!t) throw new NotFoundException('Ticket not found');
    if (input.assigneeId) {
      const staff = await this.prisma.user.findUnique({ where: { id: input.assigneeId }, select: { role: true, permissions: true, isActive: true } });
      if (!staff || !staff.isActive || !isStaff(staff) || !effectivePermissions(staff).includes('SUPPORT')) {
        throw new BadRequestException('Assign the ticket to an active staff member with support access');
      }
    }
    void me;
    await this.prisma.supportTicket.update({
      where: { id: t.id },
      data: {
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId === undefined ? undefined : input.assigneeId,
        resolvedAt: input.status ? (input.status === 'RESOLVED' ? new Date() : null) : undefined,
      },
    });
    return this.adminGet(t.id);
  }
}
