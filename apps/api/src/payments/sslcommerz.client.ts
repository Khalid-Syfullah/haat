/**
 * Minimal SSLCommerz client (hosted payment page, API v4).
 * One integration covers cards, bKash, Nagad, Rocket and net banking.
 *
 * Not exercised against a live sandbox in this repo — set SSLCZ_STORE_ID / SSLCZ_STORE_PASSWORD
 * from your sandbox account and run a test payment before launch.
 */
export interface SslSessionInput {
  tranId: string;
  amount: number;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
  customer: { name: string; email: string; phone: string; address: string; city: string };
  productName: string;
  itemCount: number;
}

export interface SslValidation {
  status: string;
  tran_id: string;
  val_id: string;
  amount: string;
  currency: string;
  bank_tran_id?: string;
  card_type?: string;
  [key: string]: unknown;
}

export class SslCommerzClient {
  private readonly storeId = process.env.SSLCZ_STORE_ID || '';
  private readonly storePassword = process.env.SSLCZ_STORE_PASSWORD || '';
  private readonly base = process.env.SSLCZ_SANDBOX === 'false' ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com';

  get configured() {
    return !!this.storeId && !!this.storePassword;
  }

  async createSession(input: SslSessionInput): Promise<{ gatewayUrl: string; sessionKey: string; raw: unknown }> {
    const body = new URLSearchParams({
      store_id: this.storeId,
      store_passwd: this.storePassword,
      total_amount: input.amount.toFixed(2),
      currency: 'BDT',
      tran_id: input.tranId,
      success_url: input.successUrl,
      fail_url: input.failUrl,
      cancel_url: input.cancelUrl,
      ipn_url: input.ipnUrl,
      cus_name: input.customer.name,
      cus_email: input.customer.email,
      cus_add1: input.customer.address,
      cus_city: input.customer.city,
      cus_country: 'Bangladesh',
      cus_phone: input.customer.phone,
      shipping_method: 'Courier',
      ship_name: input.customer.name,
      ship_add1: input.customer.address,
      ship_city: input.customer.city,
      ship_postcode: '1000',
      ship_country: 'Bangladesh',
      num_of_item: String(input.itemCount),
      product_name: input.productName.slice(0, 250),
      product_category: 'General',
      product_profile: 'physical-goods',
    });
    const res = await fetch(`${this.base}/gwprocess/v4/api.php`, { method: 'POST', body });
    const data = (await res.json()) as { status?: string; GatewayPageURL?: string; sessionkey?: string; failedreason?: string };
    if (data.status !== 'SUCCESS' || !data.GatewayPageURL) {
      throw new Error(`SSLCommerz session failed: ${data.failedreason || data.status || res.status}`);
    }
    return { gatewayUrl: data.GatewayPageURL, sessionKey: data.sessionkey || '', raw: data };
  }

  /** Server-side check of a val_id received on the success URL or IPN. */
  async validate(valId: string): Promise<SslValidation> {
    const url = new URL(`${this.base}/validator/api/validationserverAPI.php`);
    url.search = new URLSearchParams({ val_id: valId, store_id: this.storeId, store_passwd: this.storePassword, format: 'json' }).toString();
    const res = await fetch(url);
    return (await res.json()) as SslValidation;
  }

  /** Look a transaction up by our tran_id, for reconciliation when a callback never arrived. */
  async queryByTranId(tranId: string): Promise<SslValidation[]> {
    const url = new URL(`${this.base}/validator/api/merchantTransIDvalidationAPI.php`);
    url.search = new URLSearchParams({ tran_id: tranId, store_id: this.storeId, store_passwd: this.storePassword, format: 'json' }).toString();
    const res = await fetch(url);
    const data = (await res.json()) as { element?: SslValidation[] };
    return data.element ?? [];
  }
}
