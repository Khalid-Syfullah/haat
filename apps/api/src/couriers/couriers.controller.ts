import { BadRequestException, Body, Controller, Get, HttpCode, Logger, Param, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import type { Request, Response } from 'express';
import { Audit, SkipAudit } from '../common/audit';
import { AuthUser, CurrentUser, Perm, Public } from '../common/auth';
import { toInt } from '../common/utils';
import { CourierError } from './courier.types';
import { CouriersService } from './couriers.service';

class LocationDto {
  @IsOptional() @IsInt() cityId?: number;
  @IsOptional() @IsInt() zoneId?: number;
  @IsOptional() @IsInt() areaId?: number;
  @IsOptional() @IsString() @MaxLength(120) areaName?: string;
}

class BookDto {
  @IsIn(['steadfast', 'pathao', 'redx', 'test']) courier: 'steadfast' | 'pathao' | 'redx' | 'test';
  @IsOptional() @IsString() @MaxLength(250) note?: string;
  @IsOptional() @IsInt() @Min(50) @Max(50_000) weightGrams?: number;
  @IsOptional() @ValidateNested() @Type(() => LocationDto) location?: LocationDto;
}

class SimulateDto {
  @IsString() status: string;
}

@Perm(Permission.ORDERS)
@Controller('admin')
export class AdminCouriersController {
  constructor(private readonly couriers: CouriersService) {}

  @Get('couriers')
  list() {
    return this.couriers.list();
  }

  /** Pathao: kind=city | zone (parentId=cityId) | area (parentId=zoneId). RedX: kind=area&district=Dhaka. */
  @Get('couriers/:code/locations')
  locations(@Param('code') code: string, @Query() q: Record<string, string>) {
    const kind = (['city', 'zone', 'area'].includes(q.kind) ? q.kind : 'area') as 'city' | 'zone' | 'area';
    return this.couriers.locations(code, kind, q.parentId ? toInt(q.parentId, 0) : undefined, q.district);
  }

  @Audit({
    action: 'shipment.book',
    entity: 'order',
    summary: ({ body, result }) => `Booked ${body.courier} consignment ${result?.trackingCode ?? ''}${result?.codAmount ? ` (collect ৳${result.codAmount})` : ''}`,
  })
  @Post('orders/:id/shipments')
  book(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: BookDto) {
    return this.couriers.book(id, dto, user);
  }

  @SkipAudit()
  @HttpCode(200)
  @Post('shipments/:id/sync')
  sync(@Param('id') id: string) {
    return this.couriers.sync(id);
  }

  @Audit({ action: 'shipment.simulate', entity: 'shipment', summary: ({ body, result }) => `Test courier ${result?.trackingCode ?? ''}: ${body.status}` })
  @HttpCode(200)
  @Post('shipments/:id/simulate')
  simulate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SimulateDto) {
    return this.couriers.simulate(id, dto.status, user);
  }
}

/** Status callbacks from the couriers. Each courier authenticates differently (see its adapter). */
@Public()
@Controller('couriers')
export class CourierWebhooksController {
  private readonly logger = new Logger('CourierWebhook');

  constructor(private readonly couriers: CouriersService) {}

  @Post(':code/webhook')
  async webhook(@Param('code') code: string, @Req() req: Request & { rawBody?: Buffer }, @Res({ passthrough: true }) res: Response, @Query() query: Record<string, string>) {
    const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v]));
    try {
      const result = await this.couriers.handleWebhook(code, headers, query, req.body, req.rawBody?.toString('utf8'));
      for (const [k, v] of Object.entries(result.headers ?? {})) res.setHeader(k, v);
      res.status(result.status ?? 200);
      return result.body ?? { ok: true };
    } catch (err) {
      if (err instanceof CourierError && (err.detail as { status?: number } | undefined)?.status === 401) {
        this.logger.warn(`Rejected ${code} webhook: ${err.message}`);
        throw new UnauthorizedException('Webhook authentication failed');
      }
      if (err instanceof CourierError) throw new BadRequestException(err.message);
      throw err;
    }
  }
}
