/* eslint-disable no-console */
/**
 * End-to-end check of the main money paths against a running API on seeded data:
 *   npm run db:seed && npm run start   (in another terminal)
 *   npm run test:e2e
 * It changes data (orders, stock, coins), so re-seed afterwards for a clean demo.
 */
import { PrismaClient } from '@prisma/client';

const API = process.env.API_URL || 'http://localhost:4000/api';
const prisma = new PrismaClient();
let failures = 0;

class Client {
  cookie = '';
  async req<T = any>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; data: T }> {
    const res = await fetch(API + path, {
      method,
      headers: { 'content-type': 'application/json', ...(this.cookie ? { cookie: this.cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const text = await res.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: res.status, data };
  }
  get = <T = any>(p: string) => this.req<T>('GET', p);
  post = <T = any>(p: string, b?: unknown, h?: Record<string, string>) => this.req<T>('POST', p, b ?? {}, h);
  patch = <T = any>(p: string, b?: unknown) => this.req<T>('PATCH', p, b ?? {});
}

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}`, detail === undefined ? '' : JSON.stringify(detail).slice(0, 400));
  }
}

async function variantBySku(prefix: string) {
  return prisma.productVariant.findFirstOrThrow({ where: { sku: { startsWith: prefix } }, orderBy: { sku: 'asc' } });
}

async function main() {
  console.log(`Haat end-to-end checks against ${API}\n`);

  // ───── Catalog ─────
  console.log('Catalog and search');
  const anon = new Client();
  const home = await anon.get('/home');
  check('home page loads banners, flash sale and products', home.status === 200 && home.data.heroBanners.length > 0 && home.data.flashSale?.items.length > 0);
  const banglish = await anon.get('/products?q=mobail');
  check('Banglish "mobail" finds phones', banglish.data.items[0]?.title.includes('Nimbus'), banglish.data.items[0]);
  const bangla = await anon.get(`/products?q=${encodeURIComponent('পাঞ্জাবি')}`);
  check('Bangla "পাঞ্জাবি" finds the panjabi', bangla.data.items.some((i: any) => i.title.includes('Panjabi')));
  const typo = await anon.get('/products?q=hedphone');
  check('typo "hedphone" finds headphones', typo.data.items.some((i: any) => i.title.includes('Headphones')));
  const cat = await anon.get('/products?category=electronics&sort=price_asc&limit=60');
  const prices = cat.data.items.map((i: any) => i.price);
  check('category listing includes sub-categories and sorts by price', cat.data.total >= 15 && prices.every((p: number, i: number) => i === 0 || p >= prices[i - 1]));
  const product = await anon.get('/products/nimbus-x5-5g-smartphone');
  check('product page has variants, delivery zones and vouchers', product.data.variants.length === 4 && product.data.delivery.zones.length === 3);
  const guestCart = await anon.get('/cart');
  check('cart requires login', guestCart.status === 401);

  // ───── Customer: COD order with voucher and coins ─────
  console.log('\nCOD checkout with voucher and coins');
  const ayesha = new Client();
  const login = await ayesha.post('/auth/login', { login: '01711111111', password: 'customer123' });
  check('customer logs in', login.status === 200 && login.data.user.name === 'Ayesha Siddika');
  const coinsBefore = login.data.user.coins;
  const addresses = await ayesha.get('/account/addresses');
  const homeAddr = addresses.data.find((a: any) => a.isDefault);
  const quote = await ayesha.post('/checkout/quote', { addressId: homeAddr.id, voucherCode: 'SAVE10', useCoins: true });
  const q = quote.data;
  check('quote applies SAVE10 (10%, capped at ৳300)', q.discount === Math.min(300, Math.floor(q.subtotal * 0.1)), { subtotal: q.subtotal, discount: q.discount });
  check('quote gives free delivery over ৳2000', q.subtotal >= 2000 && q.shippingDiscount === q.shippingFee);
  check('coins capped at 10% of the discounted subtotal', q.coins.used === Math.min(coinsBefore, Math.floor((q.subtotal - q.discount) * 0.1)), q.coins);
  check('total adds up', q.total === q.subtotal - q.discount + q.shippingFee - q.shippingDiscount - q.coins.used);
  const stockBefore = await prisma.productVariant.findUniqueOrThrow({ where: { id: q.lines[0].variantId } });
  const placed = await ayesha.post('/checkout/place', { addressId: homeAddr.id, voucherCode: 'SAVE10', useCoins: true, paymentMethod: 'COD' });
  check('COD order placed', placed.status === 201 && ['CONFIRMED', 'PLACED'].includes(placed.data.status), placed.data);
  const codOrderNo = placed.data.orderNo;
  const stockAfter = await prisma.productVariant.findUniqueOrThrow({ where: { id: q.lines[0].variantId } });
  check('stock decremented', stockAfter.stock === stockBefore.stock - q.lines[0].quantity);
  const cartAfter = await ayesha.get('/cart');
  check('bought lines removed from cart', cartAfter.data.items.length === 0);
  const me = await ayesha.get('/auth/me');
  check('coins debited', me.data.user.coins === coinsBefore - q.coins.used);
  // TECH500 can be used once per customer.
  const phoneVariant = await variantBySku('NIM-001');
  const techOrder = await ayesha.post('/checkout/place', {
    addressId: homeAddr.id, voucherCode: 'TECH500', paymentMethod: 'COD', buyNow: { variantId: phoneVariant.id, quantity: 1 },
  });
  check('fixed voucher takes ৳500 off', techOrder.status === 201);
  const reuse = await ayesha.post('/checkout/quote', { addressId: homeAddr.id, voucherCode: 'TECH500', buyNow: { variantId: phoneVariant.id, quantity: 1 } });
  check('per-user voucher limit is enforced on reuse', reuse.data.voucher?.error?.includes('already used'), reuse.data.voucher);
  await ayesha.post(`/orders/${techOrder.data.orderNo}/cancel`, {});

  // ───── Customer cancels: everything comes back ─────
  console.log('\nCustomer cancellation');
  const cancel = await ayesha.post(`/orders/${codOrderNo}/cancel`, { reason: 'Ordered by mistake' });
  check('customer cancels before packing', cancel.status === 200);
  const stockBack = await prisma.productVariant.findUniqueOrThrow({ where: { id: q.lines[0].variantId } });
  check('stock restored', stockBack.stock === stockBefore.stock);
  const me2 = await ayesha.get('/auth/me');
  check('coins refunded', me2.data.user.coins === coinsBefore);
  const redemption = await prisma.voucherRedemption.findFirst({ where: { order: { orderNo: codOrderNo } } });
  check('voucher use reversed', !!redemption?.reversedAt);

  // ───── Online payment through the mock gateway ─────
  console.log('\nOnline payment (mock gateway)');
  const kettle = await variantBySku('RAN-029');
  await ayesha.post('/cart/items', { variantId: kettle.id, quantity: 1 });
  const online = await ayesha.post('/checkout/place', { addressId: homeAddr.id, paymentMethod: 'BKASH' });
  check('online order waits for payment', online.data.status === 'AWAITING_PAYMENT', online.data);
  const init = await ayesha.post(`/payments/${online.data.orderNo}/initiate`, {}, { 'idempotency-key': 'e2e-1' });
  check('payment session created', init.status === 200 && init.data.redirectUrl.includes('/payment/mock'), init.data);
  const init2 = await ayesha.post(`/payments/${online.data.orderNo}/initiate`, {}, { 'idempotency-key': 'e2e-1' });
  check('same idempotency key returns the same session', init2.data.redirectUrl === init.data.redirectUrl);
  const session = new URL(init.data.redirectUrl).searchParams.get('session');
  const done = await ayesha.post(`/payments/mock/${session}/complete`, { outcome: 'success' });
  check('mock payment succeeds', done.status === 200);
  await ayesha.post(`/payments/mock/${session}/complete`, { outcome: 'success' });
  const paid = await ayesha.get(`/orders/${online.data.orderNo}`);
  check('paid order is confirmed', paid.data.status === 'CONFIRMED' && paid.data.paymentStatus === 'PAID', { s: paid.data.status, p: paid.data.paymentStatus });
  check('paying twice records one payment', paid.data.payments.filter((p: any) => p.status === 'PAID').length === 1);

  // ───── Admin fulfils; customer reviews and returns ─────
  console.log('\nFulfilment, review and return');
  const admin = new Client();
  const adminLogin = await admin.post('/auth/login', { login: 'admin@haat.local', password: 'admin1234' });
  check('admin logs in', adminLogin.data.user?.role === 'ADMIN');
  const forbidden = await ayesha.get('/admin/dashboard');
  check('customers cannot open admin endpoints', forbidden.status === 403);
  const dash = await admin.get('/admin/dashboard');
  check('dashboard loads 30 days of sales', dash.status === 200 && dash.data.last30.days.length === 30);
  const orderId = paid.data.id;
  const badShip = await admin.post(`/admin/orders/${orderId}/transition`, { to: 'SHIPPED' });
  check('cannot skip packing', badShip.status === 400);
  await admin.post(`/admin/orders/${orderId}/transition`, { to: 'PACKED' });
  const noTracking = await admin.post(`/admin/orders/${orderId}/transition`, { to: 'SHIPPED' });
  check('shipping requires courier and tracking', noTracking.status === 400);
  await admin.post(`/admin/orders/${orderId}/transition`, { to: 'SHIPPED', courier: 'Steadfast', trackingNo: 'SF-E2E-1' });
  const lateCancel = await ayesha.post(`/orders/${online.data.orderNo}/cancel`, {});
  check('customer cannot cancel after shipping', lateCancel.status === 400);
  const coinsPreDelivery = (await ayesha.get('/auth/me')).data.user.coins;
  const deliveredRes = await admin.post(`/admin/orders/${orderId}/transition`, { to: 'DELIVERED' });
  check('order delivered', deliveredRes.data.status === 'DELIVERED');
  const coinsPostDelivery = (await ayesha.get('/auth/me')).data.user.coins;
  check('delivery earns 1% coins', coinsPostDelivery - coinsPreDelivery === Math.floor(paid.data.total / 100), { coinsPreDelivery, coinsPostDelivery });
  const detail = await ayesha.get(`/orders/${online.data.orderNo}`);
  const item = detail.data.items[0];
  const review = await ayesha.post('/reviews', { orderItemId: item.id, rating: 5, comment: 'Boils fast, great kettle' });
  check('buyer reviews the item and earns coins', review.status === 201 && review.data.coinsEarned === 10);
  const dup = await ayesha.post('/reviews', { orderItemId: item.id, rating: 1 });
  check('one review per item', dup.status === 400);
  const ret = await ayesha.post('/returns', { orderItemId: item.id, quantity: 1, reason: 'Damaged or defective' });
  check('return requested', ret.status === 201);
  const stockPreReturn = (await prisma.productVariant.findUniqueOrThrow({ where: { id: kettle.id } })).stock;
  await admin.post(`/admin/returns/${ret.data.id}/decision`, { action: 'approve' });
  await admin.post(`/admin/returns/${ret.data.id}/decision`, { action: 'receive', restock: true });
  const refund = await admin.post(`/admin/returns/${ret.data.id}/decision`, { action: 'refund', refundMethod: 'COINS' });
  check('return refunded as coins', refund.data.status === 'REFUNDED');
  const stockPostReturn = (await prisma.productVariant.findUniqueOrThrow({ where: { id: kettle.id } })).stock;
  check('returned item restocked', stockPostReturn === stockPreReturn + 1);

  // ───── Last unit race ─────
  console.log('\nConcurrency');
  const last = await variantBySku('VOL-016');
  await prisma.productVariant.update({ where: { id: last.id }, data: { stock: 1 } });
  const otp = new Client();
  const phone = `019${Math.floor(10000000 + Math.random() * 89999999)}`;
  const req = await otp.post('/auth/otp/request', { phone });
  const verify = await otp.post('/auth/otp/verify', { phone, code: req.data.devCode, name: 'Race Tester' });
  check('new customer signs up with OTP', verify.status === 200 && verify.data.user.phone === phone);
  const addr = await otp.post('/account/addresses', {
    fullName: 'Race Tester', phone, division: 'Sylhet', district: 'Sylhet', area: 'Zindabazar', line: 'House 1, Road 2',
  });
  const [r1, r2] = await Promise.all([
    ayesha.post('/checkout/place', { addressId: homeAddr.id, paymentMethod: 'COD', buyNow: { variantId: last.id, quantity: 1 } }),
    otp.post('/checkout/place', { addressId: addr.data.id, paymentMethod: 'COD', buyNow: { variantId: last.id, quantity: 1 } }),
  ]);
  const wins = [r1, r2].filter((r) => r.status === 201).length;
  const finalStock = (await prisma.productVariant.findUniqueOrThrow({ where: { id: last.id } })).stock;
  check('two buyers, one unit: exactly one order succeeds', wins === 1 && finalStock === 0, { r1: r1.status, r2: r2.status, finalStock });
  const newRisk = await prisma.order.findFirst({ where: { userId: verify.data.user.id }, orderBy: { createdAt: 'desc' } });
  if (newRisk) check('first-time customer gets the new-customer risk points', newRisk.riskScore >= 20, newRisk.riskScore);

  // ───── Flash-sale per-customer limit ─────
  console.log('\nFlash sale');
  const flashItem = await prisma.flashSaleItem.findFirstOrThrow({ where: { flashSale: { title: 'Payday Flash Sale' } }, include: { variant: true } });
  const flashQuote = await otp.post('/checkout/quote', { addressId: addr.data.id, buyNow: { variantId: flashItem.variantId, quantity: 3 } });
  check('flash price limited to 2 per customer', flashQuote.data.errors.some((e: string) => e.includes('limited to 2')), flashQuote.data.errors);
  const flashOk = await otp.post('/checkout/quote', { addressId: addr.data.id, buyNow: { variantId: flashItem.variantId, quantity: 1 } });
  check('flash price applied', flashOk.data.lines[0].unitPrice === flashItem.flashPrice);

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
