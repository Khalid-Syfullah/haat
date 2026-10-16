import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Permission, TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { Audit } from '../common/audit';
import { AuthUser, CurrentUser, Perm } from '../common/auth';
import { CATEGORY_LABELS, SupportService } from './support.service';

class CreateTicketDto {
  @IsOptional() @IsString() orderNo?: string;
  @IsEnum(TicketCategory) category: TicketCategory;
  @IsString() @MinLength(4) @MaxLength(120) subject: string;
  @IsString() @MinLength(10) @MaxLength(4000) message: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) images?: string[];
}

class ReplyDto {
  @IsString() @MinLength(1) @MaxLength(4000) body: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) images?: string[];
}

class StaffReplyDto extends ReplyDto {
  /** After replying: wait for the customer (default) or close the ticket. */
  @IsOptional() @IsIn(['PENDING', 'RESOLVED']) status?: 'PENDING' | 'RESOLVED';
}

class TicketUpdateDto {
  @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() assigneeId?: string | null;
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
}

/** "Help" requests from customers. */
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('categories')
  categories() {
    return Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
  }

  @Get('tickets')
  list(@CurrentUser() user: AuthUser) {
    return this.support.listMine(user.id);
  }

  @Post('tickets')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.support.create(user, dto);
  }

  @Get('tickets/:ticketNo')
  get(@CurrentUser() user: AuthUser, @Param('ticketNo') ticketNo: string) {
    return this.support.getMine(user.id, ticketNo);
  }

  @HttpCode(200)
  @Post('tickets/:ticketNo/messages')
  reply(@CurrentUser() user: AuthUser, @Param('ticketNo') ticketNo: string, @Body() dto: ReplyDto) {
    return this.support.customerReply(user, ticketNo, dto.body, dto.images);
  }

  @HttpCode(200)
  @Post('tickets/:ticketNo/resolve')
  resolve(@CurrentUser() user: AuthUser, @Param('ticketNo') ticketNo: string) {
    return this.support.customerResolve(user.id, ticketNo);
  }
}

@Perm(Permission.SUPPORT)
@Controller('admin/tickets')
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(@CurrentUser() me: AuthUser, @Query() q: Record<string, string>) {
    return this.support.adminList(me, q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.support.adminGet(id);
  }

  @Audit({
    action: 'ticket.reply',
    entity: 'ticket',
    summary: ({ body, result }) => `Replied to ticket ${result?.ticketNo ?? ''}${body.status === 'RESOLVED' ? ' and resolved it' : ''}`,
  })
  @HttpCode(200)
  @Post(':id/messages')
  reply(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: StaffReplyDto) {
    return this.support.staffReply(me, id, dto);
  }

  @Audit({
    action: 'ticket.update',
    entity: 'ticket',
    summary: ({ body, result }) =>
      `Ticket ${result?.ticketNo ?? ''}: ` +
      [
        body.status && `status ${String(body.status).toLowerCase()}`,
        body.assigneeId !== undefined && (result?.assignee ? `assigned to ${result.assignee.name}` : 'unassigned'),
        body.priority && `priority ${String(body.priority).toLowerCase()}`,
      ]
        .filter(Boolean)
        .join(', '),
  })
  @Patch(':id')
  update(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: TicketUpdateDto) {
    return this.support.staffUpdate(me, id, dto);
  }
}
