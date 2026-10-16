import { Controller, Get } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Public } from './common/auth';
import { PrismaService } from './prisma/prisma.service';

/** The deploy script writes the commit SHA to REVISION at the release root. */
function readRevision(): string | null {
  const file = resolve(process.cwd(), '..', '..', 'REVISION');
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : null;
}

const REVISION = readRevision();

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** For load balancers and uptime checks: 200 when the API and database respond. */
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, revision: REVISION, time: new Date().toISOString() };
  }
}
