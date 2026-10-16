import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertsService } from '../alerts/alerts.service';
import { CouriersService } from '../couriers/couriers.service';
import { OrderWorkflowService } from '../orders/order-workflow.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';

export const JOB_NAMES = ['expire-unpaid', 'reconcile-payments', 'alerts', 'cart-reminders', 'courier-sync'] as const;
export type JobName = (typeof JOB_NAMES)[number];

/** Background work. In a multi-instance deployment run these on one instance only (or move them to a queue). */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private running = new Set<JobName>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: OrderWorkflowService,
    private readonly payments: PaymentsService,
    private readonly alerts: AlertsService,
    private readonly couriers: CouriersService,
  ) {}

  private get disabled() {
    return process.env.DISABLE_JOBS === 'true';
  }

  /** Runs a job now (scheduled, or from Admin → Settings). Overlapping runs of one job are skipped. */
  async run(name: JobName): Promise<Record<string, number>> {
    if (this.running.has(name)) return { skipped: 1 };
    this.running.add(name);
    try {
      switch (name) {
        case 'expire-unpaid':
          return { cancelled: await this.expireUnpaid() };
        case 'reconcile-payments':
          return { fixed: await this.payments.reconcile() };
        case 'alerts':
          return await this.alerts.scan();
        case 'cart-reminders':
          return await this.alerts.cartReminders();
        case 'courier-sync':
          return await this.couriers.syncActive();
      }
    } finally {
      this.running.delete(name);
    }
  }

  private async expireUnpaid() {
    const expired = await this.prisma.order.findMany({
      where: { status: 'AWAITING_PAYMENT', expiresAt: { lt: new Date() } },
      select: { id: true, orderNo: true },
      take: 100,
    });
    let done = 0;
    for (const order of expired) {
      try {
        await this.workflow.transition(order.id, 'CANCELLED', { actor: 'system', reason: 'Payment was not completed in time' });
        this.logger.log(`Expired unpaid order ${order.orderNo}`);
        done++;
      } catch (err) {
        this.logger.warn(`Could not expire ${order.orderNo}: ${String(err)}`);
      }
    }
    return done;
  }

  private async scheduled(name: JobName) {
    if (this.disabled) return;
    try {
      await this.run(name);
    } catch (err) {
      this.logger.warn(`Job ${name} failed: ${String(err)}`);
    }
  }

  /** Cancels online orders whose payment window closed, releasing their stock. */
  @Cron(CronExpression.EVERY_MINUTE)
  expireUnpaidOrders() {
    return this.scheduled('expire-unpaid');
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  reconcilePayments() {
    return this.scheduled('reconcile-payments');
  }

  /** Price-drop and back-in-stock alerts (edits in the admin panel also trigger them straight away). */
  @Cron(CronExpression.EVERY_10_MINUTES)
  sendAlerts() {
    return this.scheduled('alerts');
  }

  @Cron(CronExpression.EVERY_HOUR)
  remindAbandonedCarts() {
    return this.scheduled('cart-reminders');
  }

  /** Backstop for missed courier webhooks. */
  @Cron(CronExpression.EVERY_30_MINUTES)
  syncCouriers() {
    return this.scheduled('courier-sync');
  }
}
