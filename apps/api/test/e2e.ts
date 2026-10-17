/* eslint-disable no-console */
/**
 * End-to-end check of the main money paths against a running API on seeded data:
 *   npm run db:seed && npm run start   (in another terminal)
 *   npm run test:e2e
 * It changes data (orders, stock, coins), so re-seed afterwards for a clean demo.
 */
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

// API_URL is the API's origin (the same variable the web app uses); "/api" is added if missing.
const API_ORIGIN = (process.env.API_URL || 'http://localhost:4000').replace(/\/+$/, '');
const API = API_ORIGIN.endsWith('/api') ? API_ORIGIN : `${API_ORIGIN}/api`;
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
  /** GET that keeps the raw bytes (CSV and Excel downloads). */
  async download(path: string) {
    const res = await fetch(API + path, { headers: this.cookie ? { cookie: this.cookie } : {} });
    return { status: res.status, type: res.headers.get('content-type') ?? '', body: Buffer.from(await res.arrayBuffer()) };
  }
  /** Multipart upload of one file field. */
  async upload(path: string, filename: string, bytes: Buffer) {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(bytes)]), filename);
    const res = await fetch(API + path, { method: 'POST', body: form, headers: this.cookie ? { cookie: this.cookie } : {} });
    const text = await res.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: res.status, data };
  }
  del = <T = any>(p: string) => this.req<T>('DELETE', p);
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
  console.log(`Tuktak Bazaar end-to-end checks against ${API}\n`);

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
  const adminLogin = await admin.post('/auth/login', { login: 'admin@tuktakbazaar.local', password: 'admin1234' });
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


  // ═════════════════════════ Phase 2 ═════════════════════════

  // ───── Staff roles and the audit log ─────
  console.log('\nStaff roles and audit log');
  const rafi = new Client();
  const rafiLogin = await rafi.post('/auth/login', { login: '01700000001', password: 'staff1234' });
  check('orders-and-support staff logs in with their permissions', rafiLogin.data.user?.role === 'STAFF' && rafiLogin.data.user.permissions.join() === 'ORDERS,SUPPORT', rafiLogin.data.user);
  const nusrat = new Client();
  await nusrat.post('/auth/login', { login: '01700000002', password: 'staff1234' });
  check('staff without catalog access cannot open products', (await rafi.get('/admin/products')).status === 403);
  check('catalog staff cannot open orders', (await nusrat.get('/admin/orders')).status === 403 && (await nusrat.get('/admin/products')).status === 200);
  check('only owners manage staff', (await rafi.get('/admin/staff')).status === 403 && (await admin.get('/admin/staff')).status === 200);
  const staffDash = await rafi.get('/admin/dashboard');
  check('staff without reports access see counts but no sales figures', staffDash.status === 200 && staffDash.data.today.revenue === null && staffDash.data.queues.openTickets >= 1, staffDash.data.today);
  const temp = `0161${Math.floor(1000000 + Math.random() * 8999999)}`;
  const added = await admin.post('/admin/staff', { name: 'Temp Packer', phone: temp, password: 'packer1234', role: 'STAFF', permissions: ['ORDERS'] });
  check('owner adds a staff member', added.status === 201 && added.data.permissions.join() === 'ORDERS', added.data);
  const packer = new Client();
  check('new staff member can log in', (await packer.post('/auth/login', { login: temp, password: 'packer1234' })).data.user?.role === 'STAFF');
  const removed = await admin.post(`/admin/staff/${added.data.id}/remove`, {});
  check('removing staff access takes effect at once', removed.data.role === 'CUSTOMER' && (await packer.get('/admin/orders')).status === 403);
  const selfDemote = await admin.patch(`/admin/staff/${adminLogin.data.user.id}`, { role: 'STAFF', permissions: ['ORDERS'] });
  check("owners can't demote themselves", selfDemote.status === 400);
  await new Promise((r) => setTimeout(r, 300)); // audit rows are written just after the response
  const audit = await admin.get(`/admin/audit-log?entityId=${orderId}`);
  check(
    'order changes are in the audit log with the staff name',
    audit.data.items.some((a: any) => a.action === 'order.status' && a.actorName === 'Store Admin' && a.summary.includes('Delivered')),
    audit.data.items.map((a: any) => a.summary),
  );
  const staffAudit = await admin.get('/admin/audit-log?q=Temp%20Packer');
  check('staff changes are audited', staffAudit.data.items.some((a: any) => a.action === 'staff.add') && staffAudit.data.items.some((a: any) => a.action === 'staff.remove'));
  check('passwords never reach the audit log', !JSON.stringify(staffAudit.data.items).includes('packer1234'));

  // ───── Courier booking and status sync ─────
  console.log('\nCourier booking');
  const couriers = await rafi.get('/admin/couriers');
  check('test courier is available outside production', couriers.data.some((c: any) => c.code === 'test' && c.configured));
  const fan = await prisma.productVariant.findFirstOrThrow({
    where: { sku: { startsWith: 'ALO-' }, isActive: true, stock: { gt: 2 }, product: { status: 'ACTIVE' } },
    orderBy: { sku: 'asc' },
  });
  await ayesha.post('/cart/items', { variantId: fan.id, quantity: 1 });
  const fanOrder = await ayesha.post('/checkout/place', { addressId: homeAddr.id, paymentMethod: 'COD' });
  const fanId = fanOrder.data.id ?? (await prisma.order.findUniqueOrThrow({ where: { orderNo: fanOrder.data.orderNo } })).id;
  const early = await rafi.post(`/admin/orders/${fanId}/shipments`, { courier: 'test' });
  check('booking needs a packed order', early.status === 400);
  if (fanOrder.data.status === 'PLACED') await rafi.post(`/admin/orders/${fanId}/transition`, { to: 'CONFIRMED' });
  await rafi.post(`/admin/orders/${fanId}/note`, { note: 'Customer wants delivery after 5pm (internal)' });
  await rafi.post(`/admin/orders/${fanId}/transition`, { to: 'PACKED' });
  const booked = await rafi.post(`/admin/orders/${fanId}/shipments`, { courier: 'test', note: 'Call before delivery' });
  check('booking a consignment ships the order with its tracking code', booked.status === 201 && /^TC\d{8}$/.test(booked.data.trackingCode), booked.data);
  const shipped = await rafi.get(`/admin/orders/${fanId}`);
  check('order carries the courier and tracking number', shipped.data.status === 'SHIPPED' && shipped.data.trackingNo === booked.data.trackingCode && shipped.data.courier === 'Test courier');
  check('COD amount on the consignment is the order total', booked.data.codAmount === shipped.data.total);
  const twice = await rafi.post(`/admin/orders/${fanId}/shipments`, { courier: 'test' });
  check('an order cannot be booked twice', twice.status === 400);
  const badHook = await new Client().post('/couriers/test/webhook', { consignment_id: booked.data.consignmentId, status: 'delivered' }, { 'x-test-courier-token': 'wrong' });
  check('webhooks with a bad secret are rejected', badHook.status === 401);
  const steadfastHook = await new Client().post('/couriers/steadfast/webhook', { notification_type: 'delivery_status', consignment_id: 1, status: 'delivered' });
  check('Steadfast webhook without its token is rejected', steadfastHook.status === 401);
  const hook = (status: string, eventId: string) =>
    new Client().post('/couriers/test/webhook', { consignment_id: booked.data.consignmentId, status, event_id: eventId }, { 'x-test-courier-token': 'test' });
  await hook('picked', 'e2e-1');
  await hook('in-transit', 'e2e-2');
  await hook('in-transit', 'e2e-2'); // a retried delivery of the same event
  const midway = await rafi.get(`/admin/orders/${fanId}`);
  const ship = midway.data.shipments[0];
  check('courier updates move the shipment along', ship.state === 'IN_TRANSIT' && midway.data.status === 'SHIPPED', ship.state);
  check('a retried webhook is applied once', ship.events.filter((e: any) => e.status === 'in-transit').length === 1);
  await hook('delivered', 'e2e-3');
  const doneFan = await ayesha.get(`/orders/${fanOrder.data.orderNo}`);
  check('courier delivery confirmation marks the order delivered', doneFan.data.status === 'DELIVERED' && doneFan.data.paymentStatus === 'PAID', doneFan.data.status);
  check('customer sees courier tracking updates', doneFan.data.shipments?.[0]?.events?.length >= 3);
  check('staff notes stay out of the customer view', !doneFan.data.events.some((e: any) => e.title === 'Staff note' || 'actorName' in e));
  check('courier updates shown to customers never name staff', !JSON.stringify(doneFan.data.shipments).includes('Rafi'));
  // A consignment the courier cancels can be booked again
  await ayesha.post('/cart/items', { variantId: fan.id, quantity: 1 });
  const fan2 = await ayesha.post('/checkout/place', { addressId: homeAddr.id, paymentMethod: 'COD' });
  const fan2Id = (await prisma.order.findUniqueOrThrow({ where: { orderNo: fan2.data.orderNo } })).id;
  if (fan2.data.status === 'PLACED') await rafi.post(`/admin/orders/${fan2Id}/transition`, { to: 'CONFIRMED' });
  await rafi.post(`/admin/orders/${fan2Id}/transition`, { to: 'PACKED' });
  const first = await rafi.post(`/admin/orders/${fan2Id}/shipments`, { courier: 'test' });
  await new Client().post('/couriers/test/webhook', { consignment_id: first.data.consignmentId, status: 'cancelled', event_id: 'e2e-c1' }, { 'x-test-courier-token': 'test' });
  const second = await rafi.post(`/admin/orders/${fan2Id}/shipments`, { courier: 'test' });
  const rebooked = await rafi.get(`/admin/orders/${fan2Id}`);
  check('a cancelled consignment can be booked again', second.status === 201 && rebooked.data.trackingNo === second.data.trackingCode && rebooked.data.status === 'SHIPPED', second.data);
  // Two staff booking the same order at once get one consignment between them
  await ayesha.post('/cart/items', { variantId: fan.id, quantity: 1 });
  const fan3 = await ayesha.post('/checkout/place', { addressId: homeAddr.id, paymentMethod: 'COD' });
  const fan3Id = (await prisma.order.findUniqueOrThrow({ where: { orderNo: fan3.data.orderNo } })).id;
  if (fan3.data.status === 'PLACED') await rafi.post(`/admin/orders/${fan3Id}/transition`, { to: 'CONFIRMED' });
  await rafi.post(`/admin/orders/${fan3Id}/transition`, { to: 'PACKED' });
  const race = await Promise.all([rafi.post(`/admin/orders/${fan3Id}/shipments`, { courier: 'test' }), admin.post(`/admin/orders/${fan3Id}/shipments`, { courier: 'test' })]);
  const raceShipments = await prisma.shipment.count({ where: { orderId: fan3Id } });
  check('booking the same order twice at once makes one consignment', raceShipments === 1 && race.filter((r) => r.status === 201).length === 1 && race.some((r) => r.status === 400 || r.status === 409), race.map((r) => r.status));
  // The order update after a delivery report failed (say the server restarted): the courier job finishes it
  await prisma.shipment.updateMany({ where: { orderId: fan3Id }, data: { state: 'DELIVERED', courierStatus: 'delivered' } });
  const repair = await admin.post('/admin/jobs/courier-sync/run');
  const repairedOrder = await prisma.order.findUniqueOrThrow({ where: { id: fan3Id } });
  check('an order stuck after a delivery report is brought up to date', repair.data.repaired >= 1 && repairedOrder.status === 'DELIVERED' && repairedOrder.paymentStatus === 'PAID', repair.data);
  const lateHook = await hook('returned', 'e2e-4');
  check('a final state is never overwritten', lateHook.status === 200 && (await rafi.get(`/admin/orders/${fanId}`)).data.status === 'DELIVERED');

  // ───── Reports and CSV export ─────
  console.log('\nReports');
  const summary = await admin.get('/admin/reports/summary');
  check('sales summary covers the last 30 days', summary.status === 200 && summary.data.range.days === 30 && summary.data.days.length === 30 && summary.data.orders > 0);
  check('summary revenue matches the daily series', summary.data.days.reduce((s: number, d: any) => s + d.revenue, 0) === summary.data.revenue);
  check('reports need the reports permission', (await rafi.get('/admin/reports/summary')).status === 403);
  const cats = await admin.get('/admin/reports/categories');
  const share = cats.data.items.reduce((s: number, c: any) => s + c.share, 0);
  check('category shares add up to 100%', cats.data.items.length > 0 && Math.abs(share - 100) < 1, share);
  const prods = await admin.get('/admin/reports/products?limit=5');
  check('best sellers are sorted by revenue', prods.data.items.every((p: any, i: number, a: any[]) => i === 0 || a[i - 1].revenue >= p.revenue));
  const kettleRow = (await admin.get('/admin/reports/products?limit=500')).data.items.find((p: any) => p.productId === kettle.productId);
  check('return rate counts the returned item', kettleRow?.returnedUnits >= 1 && kettleRow.returnRate > 0, kettleRow);
  const csv = await admin.download('/admin/reports/export/products');
  check('CSV export opens in Excel (UTF-8 with BOM)', csv.status === 200 && csv.type.startsWith('text/csv') && csv.body.toString('utf8').startsWith('﻿Product,Orders'));
  const realName = (await prisma.order.findUniqueOrThrow({ where: { id: fanId } })).shipName;
  await prisma.order.update({ where: { id: fanId }, data: { shipName: '=1+2' } });
  const ordersCsv = await admin.download('/admin/reports/export/orders');
  await prisma.order.update({ where: { id: fanId }, data: { shipName: realName } });
  check('orders export lists this run’s orders', ordersCsv.body.toString('utf8').includes(fanOrder.data.orderNo));
  check('names that look like formulas export as plain text', ordersCsv.body.toString('utf8').includes(",'=1+2,") && !ordersCsv.body.toString('utf8').includes(',=1+2,'));
  await new Promise((r) => setTimeout(r, 300));
  check('downloads of customer data are audited', (await admin.get('/admin/audit-log?q=orders%20report')).data.items.some((a: any) => a.action === 'report.export'));

  // ───── Price-drop and back-in-stock alerts ─────
  console.log('\nAlerts');
  const soldOut = await prisma.productVariant.findUniqueOrThrow({ where: { id: last.id } });
  const stockAlert = await ayesha.post('/alerts', { variantId: soldOut.id, type: 'BACK_IN_STOCK' });
  check('customer asks to be told when a sold-out item is back', stockAlert.status === 201 && soldOut.stock === 0);
  const inStock = await ayesha.post('/alerts', { variantId: kettle.id, type: 'BACK_IN_STOCK' });
  check('in-stock items can’t get a back-in-stock alert', inStock.status === 400);
  const plain = await prisma.productVariant.findFirstOrThrow({
    where: { isActive: true, stock: { gt: 5 }, flashItems: { none: {} }, salePrice: { not: null }, product: { status: 'ACTIVE' } },
  });
  const priceAlert = await ayesha.post('/alerts', { variantId: plain.id, type: 'PRICE_DROP' });
  check('customer asks to be told about a price drop', priceAlert.status === 201 && priceAlert.data.priceAtSubscribe === plain.salePrice);
  const smsBefore = await prisma.smsLog.count({ where: { phone: '01711111111', kind: 'alert' } });
  const restock = await nusrat.post('/admin/inventory/bulk', { variantIds: [soldOut.id], action: 'stock_add', value: 5, note: 'New shipment from supplier' });
  const cut = await nusrat.post('/admin/inventory/bulk', { variantIds: [plain.id], action: 'sale_set', value: plain.salePrice! - 50 });
  check('bulk stock and price edits apply', restock.data.updated === 1 && cut.data.updated === 1);
  await new Promise((r) => setTimeout(r, 800));
  const notes = (await ayesha.get('/notifications')).data.items;
  check('back-in-stock alert reaches the customer', notes.some((n: any) => n.title === 'Back in stock'));
  check('price-drop alert names the new price', notes.some((n: any) => n.title === 'Price dropped' && n.body.includes(`৳${plain.salePrice! - 50}`)));
  check('alerts are also sent by SMS', (await prisma.smsLog.count({ where: { phone: '01711111111', kind: 'alert' } })) === smsBefore + 2);
  const myAlerts = (await ayesha.get('/alerts')).data;
  check('fired alerts show as sent', myAlerts.filter((a: any) => a.notifiedAt).length >= 2);
  await nusrat.post('/admin/inventory/bulk', { variantIds: [plain.id], action: 'sale_set', value: plain.salePrice! - 60 });
  await new Promise((r) => setTimeout(r, 500));
  check('an alert fires once', (await prisma.smsLog.count({ where: { phone: '01711111111', kind: 'alert' } })) === smsBefore + 2);
  await nusrat.post('/admin/inventory/bulk', { variantIds: [plain.id], action: 'deactivate' });
  const visible = (await nusrat.get(`/admin/inventory?q=${plain.sku}`)).data.items.length;
  const withHidden = (await nusrat.get(`/admin/inventory?q=${plain.sku}&hidden=true`)).data.items;
  check('hidden SKUs can still be found and shown again', visible === 0 && withHidden[0]?.isActive === false);
  await nusrat.post('/admin/inventory/bulk', { variantIds: [plain.id], action: 'activate' });
  const badBulk = await nusrat.post('/admin/inventory/bulk', { variantIds: [plain.id], action: 'sale_set', value: plain.price + 10 });
  check('bulk edits refuse a sale price above the price', badBulk.status === 400);
  await nusrat.post('/admin/inventory/bulk', { variantIds: [plain.id], action: 'sale_set', value: plain.salePrice! });

  // ───── Abandoned-cart reminders ─────
  console.log('\nAbandoned cart');
  // A shopper who added to cart 7 hours ago and hasn't ordered since
  const browser = new Client();
  const browserPhone = `017${Math.floor(10000000 + Math.random() * 89999999)}`;
  const code = (await browser.post('/auth/otp/request', { phone: browserPhone })).data.devCode;
  const browserUser = (await browser.post('/auth/otp/verify', { phone: browserPhone, code, name: 'Window Shopper' })).data.user;
  await browser.post('/cart/items', { variantId: plain.id, quantity: 1 });
  const cart = await prisma.cart.findUniqueOrThrow({ where: { userId: browserUser.id } });
  await prisma.cartItem.updateMany({ where: { cartId: cart.id }, data: { updatedAt: new Date(Date.now() - 7 * 3600_000) } });
  // Ayesha's cart is just as old, but she ordered since, so she gets nothing.
  const ayeshaCart = await prisma.cart.findUniqueOrThrow({ where: { userId: login.data.user.id } });
  await ayesha.post('/cart/items', { variantId: plain.id, quantity: 1 });
  await prisma.cartItem.updateMany({ where: { cartId: ayeshaCart.id }, data: { updatedAt: new Date(Date.now() - 7 * 3600_000) } });
  const remind = await admin.post('/admin/jobs/cart-reminders/run', {});
  const shopperSms = () => prisma.smsLog.count({ where: { phone: browserPhone, kind: 'cart' } });
  check('a cart left for 7 hours gets a reminder', remind.status === 200 && (await shopperSms()) === 1, remind.data);
  check('no reminder for someone who has ordered since', (await prisma.smsLog.count({ where: { phone: '01711111111', kind: 'cart' } })) === 0);
  await admin.post('/admin/jobs/cart-reminders/run', {});
  check('no second reminder without new cart activity', (await shopperSms()) === 1);
  await ayesha.patch('/account/profile', { marketingSms: false });
  check('customers can turn off SMS reminders', (await ayesha.get('/auth/me')).data.user.marketingSms === false);
  await ayesha.patch('/account/profile', { marketingSms: true });

  // ───── Support tickets ─────
  console.log('\nSupport tickets');
  const ticket = await ayesha.post('/support/tickets', {
    orderNo: fanOrder.data.orderNo,
    category: 'ORDER_ISSUE',
    subject: 'Fan arrived with a cracked stand',
    message: 'The base of the fan stand is cracked. Can you send a replacement stand?',
  });
  check('customer opens a ticket about an order', ticket.status === 201 && ticket.data.status === 'OPEN');
  check('order problems are high priority', (await prisma.supportTicket.findUniqueOrThrow({ where: { ticketNo: ticket.data.ticketNo } })).priority === 'HIGH');
  const queue = await rafi.get('/admin/tickets?status=OPEN');
  check('support staff see it in the open queue', queue.data.items.some((t: any) => t.ticketNo === ticket.data.ticketNo));
  check('staff without support access cannot read tickets', (await nusrat.get('/admin/tickets')).status === 403);
  const answered = await rafi.post(`/admin/tickets/${ticket.data.ticketNo}/messages`, { body: 'Sorry about that! A new stand goes out with tomorrow’s courier.' });
  check('staff reply waits for the customer and assigns the ticket', answered.data.status === 'PENDING' && answered.data.assignee?.name === 'Rafi Ahmed');
  const thread = await ayesha.get(`/support/tickets/${ticket.data.ticketNo}`);
  check('customer sees the reply with the first name of who helped', thread.data.messages[1]?.author.startsWith('Rafi,') && thread.data.status === 'PENDING', thread.data.messages[1]?.author);
  const back = await ayesha.post(`/support/tickets/${ticket.data.ticketNo}/messages`, { body: 'Thank you, that works.' });
  check('customer reply reopens the ticket for staff', back.data.status === 'OPEN');
  const stranger = await otp.get(`/support/tickets/${ticket.data.ticketNo}`);
  check("customers can't read each other's tickets", stranger.status === 404);
  const closed = await rafi.post(`/admin/tickets/${ticket.data.ticketNo}/messages`, { body: 'Glad to help!', status: 'RESOLVED' });
  check('staff can reply and resolve in one step', closed.data.status === 'RESOLVED');
  check('ticket replies notify by SMS', (await prisma.smsLog.count({ where: { kind: 'ticket', phone: '01711111111' } })) >= 2);

  // ───── Excel import and export ─────
  console.log('\nExcel import and export');
  const xlsx = await nusrat.download('/admin/catalog/export');
  check('catalog exports as an Excel workbook', xlsx.status === 200 && xlsx.type.includes('spreadsheetml'));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsx.body as unknown as ArrayBuffer);
  const sheet = wb.getWorksheet('Products')!;
  const headers = (sheet.getRow(1).values as string[]).slice(1);
  const col = (h: string) => headers.indexOf(h) + 1;
  check('export has one row per SKU', sheet.rowCount - 1 === (await prisma.productVariant.count()));
  let target = 0;
  sheet.eachRow((row, n) => {
    if (n > 1 && row.getCell(col('SKU')).value === plain.sku) target = n;
  });
  sheet.getRow(target).getCell(col('Price')).value = plain.price + 100;
  sheet.getRow(target).getCell(col('Stock')).value = 77;
  const handle = String(sheet.getRow(target).getCell(col('Product handle')).value);
  const add = sheet.addRow([]);
  add.getCell(col('Product handle')).value = 'e2e-import-lamp';
  add.getCell(col('Title')).value = 'E2E Import Desk Lamp';
  add.getCell(col('Category')).value = 'nowhere-category';
  add.getCell(col('SKU')).value = 'E2E-LAMP-1';
  add.getCell(col('Price')).value = 990;
  add.getCell(col('Stock')).value = 4;
  const toBuffer = async () => Buffer.from(await wb.xlsx.writeBuffer());
  const preview = await nusrat.upload('/admin/catalog/import', 'catalog.xlsx', await toBuffer());
  check('preview reports a bad category with its row number', preview.status === 200 && preview.data.errors.some((e: any) => e.row === add.number && e.message.includes('nowhere-category')), preview.data.errors);
  const refused = await nusrat.upload('/admin/catalog/import?apply=true', 'catalog.xlsx', await toBuffer());
  const unchanged = await prisma.productVariant.findUniqueOrThrow({ where: { id: plain.id } });
  check('a file with errors changes nothing', refused.status === 400 && unchanged.price === plain.price);
  const category = await prisma.category.findFirstOrThrow({ where: { parentId: { not: null } } });
  add.getCell(col('Category')).value = category.slug;
  const good = await nusrat.upload('/admin/catalog/import', 'catalog.xlsx', await toBuffer());
  check('preview lists the changes', good.data.errors.length === 0 && good.data.summary.newProducts === 1 && good.data.summary.updatedVariants >= 1, good.data.summary);
  check('preview shows the price change', good.data.changes.some((c: any) => c.sku === plain.sku && c.details.includes(`price ৳${plain.price} → ৳${plain.price + 100}`)));
  const applied = await nusrat.upload('/admin/catalog/import?apply=true', 'catalog.xlsx', await toBuffer());
  const afterImport = await prisma.productVariant.findUniqueOrThrow({ where: { id: plain.id } });
  check('import applies the changes', applied.status === 200 && applied.data.applied && afterImport.price === plain.price + 100 && afterImport.stock === 77);
  const lamp = await prisma.product.findUnique({ where: { slug: 'e2e-import-lamp' }, include: { variants: true } });
  check('import creates new products', lamp?.title === 'E2E Import Desk Lamp' && lamp.variants[0]?.sku === 'E2E-LAMP-1' && lamp.variants[0].stock === 4);
  const moves = await prisma.inventoryMovement.findMany({ where: { variantId: plain.id, note: 'Excel import' } });
  check('stock changes from Excel are in the movement log', moves.length === 1 && moves[0].delta === 77 - unchanged.stock);
  check('imports are audited', (await admin.get('/admin/audit-log?q=catalog.xlsx')).data.items.some((a: any) => a.action === 'catalog.import'));
  void handle;
  // Giving the lamp (no options yet) a Colour option
  const lampSheet = async (rows: Record<string, string | number>[]) => {
    const book = new ExcelJS.Workbook();
    const ws = book.addWorksheet('Products');
    ws.addRow(headers);
    for (const r of rows) {
      const line = ws.addRow([]);
      for (const [h, v] of Object.entries(r)) line.getCell(col(h)).value = v;
    }
    return Buffer.from(await book.xlsx.writeBuffer());
  };
  const black = { 'Product handle': 'e2e-import-lamp', SKU: 'E2E-LAMP-2', Price: 990, Stock: 2, 'Option 1 name': 'Colour', 'Option 1 value': 'Black' };
  const partial = await nusrat.upload('/admin/catalog/import', 'lamp.xlsx', await lampSheet([black]));
  check('adding options needs every SKU of the product', partial.data.errors.some((e: any) => e.message.includes('E2E-LAMP-1')), partial.data.errors);
  const white = { 'Product handle': 'e2e-import-lamp', SKU: 'E2E-LAMP-1', 'Option 1 name': 'Colour', 'Option 1 value': 'White' };
  const withOptions = await nusrat.upload('/admin/catalog/import?apply=true', 'lamp.xlsx', await lampSheet([white, black]));
  const lamp2 = await prisma.product.findUniqueOrThrow({ where: { slug: 'e2e-import-lamp' }, include: { variants: { orderBy: { sku: 'asc' } } } });
  check(
    'import adds options to an existing product',
    withOptions.status === 200 && lamp2.optionNames.join() === 'Colour' && lamp2.variants.map((v) => (v.options as any)?.Colour).join() === 'White,Black',
    { status: withOptions.status, optionNames: lamp2.optionNames, errors: withOptions.data.errors },
  );
  const lampSku = lamp2.variants[0];
  await nusrat.post('/admin/inventory/bulk', { variantIds: [lampSku.id], action: 'price_set', value: 40 });
  const noDiscount = await nusrat.post('/admin/inventory/bulk', { variantIds: [lampSku.id], action: 'sale_pct_off', value: 1 });
  check('a percent off that rounds to the full price is refused', noDiscount.status === 400 && (await prisma.productVariant.findUniqueOrThrow({ where: { id: lampSku.id } })).salePrice === null);

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
