import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderWorkflowService } from '../orders/order-workflow.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';

/** Background work. In a multi-instance deployment run these on one instance only (or move them to a queue). */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: OrderWorkflowService,
    private readonly payments: PaymentsService,
  ) {}

  /** Cancels online orders whose payment window closed, releasing their stock. */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireUnpaidOrders() {
    if (this.running || process.env.DISABLE_JOBS === 'true') return;
    this.running = true;
    try {
      const expired = await this.prisma.order.findMany({
        where: { status: 'AWAITING_PAYMENT', expiresAt: { lt: new Date() } },
        select: { id: true, orderNo: true },
        take: 100,
      });
      for (const order of expired) {
        try {
          await this.workflow.transition(order.id, 'CANCELLED', { actor: 'system', reason: 'Payment was not completed in time' });
          this.logger.log(`Expired unpaid order ${order.orderNo}`);
        } catch (err) {
          this.logger.warn(`Could not expire ${order.orderNo}: ${String(err)}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcilePayments() {
    if (process.env.DISABLE_JOBS === 'true') return;
    const fixed = await this.payments.reconcile();
    if (fixed) this.logger.log(`Reconciled ${fixed} payment(s)`);
  }
}
