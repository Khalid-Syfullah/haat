import { Body, Controller, Get, Headers, HttpCode, Param, Post, Res } from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { PaymentsService } from './payments.service';

class MockCompleteDto {
  @IsIn(['success', 'fail']) outcome: 'success' | 'fail';
}

type SslBody = { tran_id?: string; val_id?: string; status?: string };

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  private web(path: string) {
    return `${process.env.WEB_URL || 'http://localhost:3000'}${path}`;
  }

  @HttpCode(200)
  @Post(':orderNo/initiate')
  initiate(
    @CurrentUser() user: AuthUser,
    @Param('orderNo') orderNo: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.payments.initiate(user.id, orderNo, key);
  }

  // ───── Mock gateway ─────

  @Get('mock/:session')
  mockSession(@CurrentUser() user: AuthUser, @Param('session') session: string) {
    return this.payments.mockSession(user.id, session);
  }

  @HttpCode(200)
  @Post('mock/:session/complete')
  mockComplete(@CurrentUser() user: AuthUser, @Param('session') session: string, @Body() dto: MockCompleteDto) {
    return this.payments.mockComplete(user.id, session, dto.outcome);
  }

  // ───── SSLCommerz: the gateway posts form data to these and the browser follows the redirect ─────

  @Public()
  @Post('sslcommerz/success')
  async sslSuccess(@Body() body: SslBody, @Res() res: Response) {
    if (!body.tran_id || !body.val_id) return res.redirect(303, this.web('/account/orders?tab=to-pay'));
    const { order, paid } = await this.payments.confirmSsl(body.tran_id, body.val_id);
    return res.redirect(303, this.web(`/account/orders/${order.orderNo}?payment=${paid ? 'success' : 'pending'}`));
  }

  @Public()
  @Post('sslcommerz/fail')
  async sslFail(@Body() body: SslBody, @Res() res: Response) {
    if (body.tran_id) await this.payments.markFailed(body.tran_id, body);
    const orderNo = body.tran_id ? await this.payments.orderNoForPayment(body.tran_id) : null;
    return res.redirect(303, this.web(orderNo ? `/account/orders/${orderNo}?payment=failed` : '/account/orders?tab=to-pay'));
  }

  @Public()
  @Post('sslcommerz/cancel')
  async sslCancel(@Body() body: SslBody, @Res() res: Response) {
    if (body.tran_id) await this.payments.markFailed(body.tran_id, body);
    const orderNo = body.tran_id ? await this.payments.orderNoForPayment(body.tran_id) : null;
    return res.redirect(303, this.web(orderNo ? `/account/orders/${orderNo}?payment=cancelled` : '/account/orders?tab=to-pay'));
  }

  /** Instant Payment Notification: server-to-server, independent of the customer's browser. */
  @Public()
  @HttpCode(200)
  @Post('sslcommerz/ipn')
  async sslIpn(@Body() body: SslBody) {
    if (body.tran_id && body.val_id && (body.status === 'VALID' || body.status === 'VALIDATED')) {
      await this.payments.confirmSsl(body.tran_id, body.val_id);
    }
    return { received: true };
  }
}
