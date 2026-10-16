import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type SmsKind = 'otp' | 'alert' | 'cart' | 'ticket' | 'order';

export interface SmsResult {
  ok: boolean;
  status: 'sent' | 'failed' | 'logged';
  error?: string;
}

/**
 * Sends SMS through the configured provider and records every message in SmsLog.
 *
 *   SMS_PROVIDER=console      (default) print to the API log, nothing leaves the server
 *   SMS_PROVIDER=sslwireless  SSL Wireless SMS Plus API v3
 *       SSL_SMS_API_TOKEN, SSL_SMS_SID, optional SSL_SMS_URL
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger('SMS');

  constructor(private readonly prisma: PrismaService) {}

  get provider(): 'console' | 'sslwireless' {
    return process.env.SMS_PROVIDER === 'sslwireless' ? 'sslwireless' : 'console';
  }

  /** True when messages actually reach phones. */
  get live(): boolean {
    return this.provider === 'sslwireless' && !!process.env.SSL_SMS_API_TOKEN && !!process.env.SSL_SMS_SID;
  }

  async send(phone: string, body: string, kind: SmsKind, userId?: string): Promise<SmsResult> {
    let result: SmsResult;
    let providerRef: string | undefined;
    if (this.provider === 'console') {
      this.logger.log(`[${kind}] to ${phone}: ${body}`);
      result = { ok: true, status: 'logged' };
    } else {
      const out = await this.sendSslWireless(phone, body);
      result = out.result;
      providerRef = out.ref;
    }
    try {
      await this.prisma.smsLog.create({
        // Login codes are never stored
        data: { phone, body: kind === 'otp' ? body.replace(/\d{4,8}/, '••••••') : body, kind, provider: this.provider, status: result.status, error: result.error, providerRef, userId },
      });
    } catch (err) {
      this.logger.warn(`Could not record SMS: ${String(err)}`);
    }
    return result;
  }

  private async sendSslWireless(phone: string, body: string): Promise<{ result: SmsResult; ref?: string }> {
    const token = process.env.SSL_SMS_API_TOKEN;
    const sid = process.env.SSL_SMS_SID;
    if (!token || !sid) return { result: { ok: false, status: 'failed', error: 'SSL_SMS_API_TOKEN or SSL_SMS_SID is not set' } };
    const csmsId = `haat${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
    try {
      const res = await fetch(process.env.SSL_SMS_URL || 'https://smsplus.sslwireless.com/api/v3/send-sms', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        // msisdn without "+": 8801XXXXXXXXX
        body: JSON.stringify({ api_token: token, sid, msisdn: `88${phone}`, sms: body, csms_id: csmsId }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error_message?: string; smsinfo?: { reference_id?: string; sms_status?: string }[] };
      const sent = res.ok && String(data.status).toUpperCase() === 'SUCCESS';
      if (!sent) this.logger.warn(`SSL Wireless refused SMS to ${phone}: ${data.error_message ?? res.status}`);
      return {
        result: sent ? { ok: true, status: 'sent' } : { ok: false, status: 'failed', error: data.error_message || `HTTP ${res.status}` },
        ref: data.smsinfo?.[0]?.reference_id ?? csmsId,
      };
    } catch (err) {
      this.logger.warn(`SMS to ${phone} failed: ${String(err)}`);
      return { result: { ok: false, status: 'failed', error: String(err).slice(0, 200) }, ref: csmsId };
    }
  }
}
