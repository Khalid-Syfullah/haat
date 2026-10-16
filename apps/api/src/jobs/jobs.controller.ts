import { BadRequestException, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { Audit } from '../common/audit';
import { Perm } from '../common/auth';
import { SmsService } from '../common/sms.service';
import { CouriersService } from '../couriers/couriers.service';
import { JOB_NAMES, JobName, JobsService } from './jobs.service';

const JOB_INFO: Record<JobName, { label: string; schedule: string }> = {
  'expire-unpaid': { label: 'Cancel unpaid online orders', schedule: 'Every minute' },
  'reconcile-payments': { label: 'Re-check open payments with the gateway', schedule: 'Every 10 minutes' },
  alerts: { label: 'Send price-drop and back-in-stock alerts', schedule: 'Every 10 minutes' },
  'cart-reminders': { label: 'Send abandoned-cart reminders', schedule: 'Every hour' },
  'courier-sync': { label: 'Fetch courier statuses', schedule: 'Every 30 minutes' },
};

/** Integration status and background jobs, for Admin → Settings. */
@Perm(Permission.SETTINGS)
@Controller('admin')
export class AdminSystemController {
  constructor(
    private readonly jobs: JobsService,
    private readonly sms: SmsService,
    private readonly couriers: CouriersService,
  ) {}

  @Get('system')
  status() {
    return {
      jobsEnabled: process.env.DISABLE_JOBS !== 'true',
      jobs: JOB_NAMES.map((name) => ({ name, ...JOB_INFO[name] })),
      sms: { provider: this.sms.provider, live: this.sms.live },
      payments: { provider: process.env.PAYMENT_PROVIDER === 'sslcommerz' ? 'sslcommerz' : 'mock' },
      couriers: this.couriers.list(),
    };
  }

  @Audit({
    action: 'job.run',
    entity: 'job',
    summary: ({ params, result }) =>
      `Ran "${JOB_INFO[params.name as JobName]?.label ?? params.name}": ` +
      (Object.entries((result ?? {}) as Record<string, number>).map(([k, v]) => `${v} ${k}`).join(', ') || 'done'),
  })
  @HttpCode(200)
  @Post('jobs/:name/run')
  run(@Param('name') name: string) {
    if (!JOB_NAMES.includes(name as JobName)) throw new BadRequestException('Unknown job');
    return this.jobs.run(name as JobName);
  }
}
