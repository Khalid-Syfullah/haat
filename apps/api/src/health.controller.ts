import { Controller, Get } from '@nestjs/common';
import { Public } from './common/auth';
import { PrismaService } from './prisma/prisma.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** For load balancers and uptime checks: 200 when the API and database respond. */
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, time: new Date().toISOString() };
  }
}
