import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AlertType } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/auth';
import { AlertsService } from './alerts.service';

class SubscribeDto {
  @IsString() variantId: string;
  @IsEnum(AlertType) type: AlertType;
}

/** A customer's "notify me" alerts. */
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser) {
    return this.alerts.mine(user.id);
  }

  @Post()
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribeDto) {
    return this.alerts.subscribe(user.id, dto.variantId, dto.type);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.alerts.remove(user.id, id);
  }
}
