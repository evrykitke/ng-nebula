// The order-to-cash chain, driven through the UI end to end:
//
//   customer → order → confirm → reserve → deliver → invoice → payment
//
// Every state transition is triggered by clicking the real page controls, then
// asserted against the backend. The last step checks the AR subledger still
// reconciles to the ledger with an empty GL outbox — the same invariant the
// scm_gl.rs integration test guards, verified here through the whole stack.
//
// Needs a running dev stack and a tenant with sellable, stocked items:
//   E2E_EMAIL=... E2E_PASSWORD=... npm run e2e:o2c
//
// Writes real records (a customer, order, delivery, invoice, payment) — point
// it at a dev tenant, never production.
import {
  api, BASE, clickInModal, clickText, formError, reporter, signIn, sleep, UUID, waitUrl, waitUrlRe,
} from './harness.mjs';

const report = reporter();
const { browser, page, signedIn } = await signIn();
report.step('Sign in', signedIn, page.url());
if (!signedIn) { await browser.close(); report.finish('ORDER TO CASH'); }

// The customer form's POST carries the new id; capturing it is steadier than
// racing the navigation.
let createdCustomerId = '';
page.on('requestfinished', async (req) => {
  if (req.method() !== 'POST' || !req.url().endsWith('/sales/customers')) return;
  try { createdCustomerId = JSON.parse(await req.response().text()).id; } catch {}
});

const stamp = Date.now().toString().slice(-6);
const code = `E2E-${stamp}`;
const name = `E2E Test Customer ${stamp}`;

try {
  // --- Fixtures: a warehouse and a sellable item that actually has stock ---
  const [whs, items, levels] = await Promise.all([
    api(page, '/inventory/warehouses'),
    api(page, '/inventory/items?active=true'),
    api(page, '/inventory/stock/levels'),
  ]);
  const stocked = (levels.body ?? []).find(
    (l) => Number(l.on_hand ?? 0) >= 100 &&
      (items.body ?? []).some((i) => i.id === l.item_id && i.is_sellable),
  );
  const warehouse = (whs.body ?? []).find((w) => w.code === stocked?.warehouse_code) ??
    (whs.body ?? []).find((w) => w.is_active);
  const item = (items.body ?? []).find((i) => i.id === stocked?.item_id);
  report.step('Find a stocked sellable item', !!item && !!warehouse,
    item ? `${item.sku} @ ${warehouse?.code} (on_hand=${stocked.on_hand})` : 'none found — seed the tenant first');
  if (!item || !warehouse) throw new Error('no stocked sellable item to sell');

  // --- 1. Create the customer through the form ---
  await page.goto(`${BASE}/sales/customers/new`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[name=code]');
  await page.type('input[name=code]', code);
  await page.type('input[name=name]', name);
  await clickText(page, 'Save customer');
  const deadline = Date.now() + 15000;
  while (!createdCustomerId && Date.now() < deadline) await sleep(200);
  const custId = createdCustomerId;
  report.step('Create customer (form)', !!custId, custId || `stuck on form: ${await formError(page)}`);
  if (!custId) throw new Error('customer not created');

  // A new customer is cash-only until given a credit line; the order below is on
  // terms, so set one. (Done over the API: the form's number inputs do not take
  // synthetic typing reliably.)
  const credit = await api(page, `/sales/customers/${custId}`, 'PUT', {
    code, name, currency: 'USD', customer_type: 'company',
    payment_terms_days: 30, credit_limit: '100000',
  });
  report.step('Grant credit limit', credit.status < 300, `credit_limit=${credit.body?.credit_limit}`);

  // --- 2. A draft order to drive the rest of the chain ---
  const order = await api(page, '/sales/orders', 'POST', {
    customer_id: custId,
    warehouse_id: warehouse.id,
    order_date: new Date().toISOString().slice(0, 10),
    lines: [{ item_id: item.id, qty: '100', unit_price: '0.10' }],
  });
  const orderId = order.body?.id;
  report.step('Create draft order', order.status < 300 && !!orderId, `total=${order.body?.total}`);
  if (!orderId) throw new Error('no order: ' + JSON.stringify(order.body).slice(0, 200));

  await page.goto(`${BASE}/sales/orders/${orderId}`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  report.step('Order detail renders', page.url().includes(orderId));

  // --- 3. Confirm (header action opens a modal for the exchange rate) ---
  await clickText(page, 'Confirm', 'app-page-header');
  await sleep(800);
  await clickInModal(page, 'Confirm');
  await sleep(2000);
  let ord = await api(page, `/sales/orders/${orderId}`);
  report.step('Confirm order', ord.body?.status === 'confirmed', `status=${ord.body?.status}`);

  // --- 4. Reserve stock ---
  await clickText(page, 'Reserve stock', 'app-page-header');
  await sleep(1800);
  ord = await api(page, `/sales/orders/${orderId}`);
  const reserved = Number(ord.body?.lines?.[0]?.reserved_qty ?? 0);
  report.step('Reserve stock', reserved >= 100, `reserved_qty=${reserved}`);

  // --- 5. Deliver: the order's action prefills the delivery form ---
  await clickText(page, 'Deliver', 'app-page-header');
  await waitUrl(page, '/sales/deliveries/new', 15000);
  await sleep(1800);
  if (item.track_batches) {
    // A batch-tracked item must name the lot being shipped. Angular's [name]
    // binding is not reflected to the DOM, so target the batch cell by its
    // placeholder within the first line.
    const batches = await api(page, `/inventory/items/${item.id}/batches`);
    const lot = (batches.body ?? []).find((b) => Number(b.on_hand) >= 100)?.batch_no ?? batches.body?.[0]?.batch_no;
    const sel = 'tbody tr:first-child input[placeholder="Optional"]';
    await page.waitForSelector(sel, { timeout: 10000 });
    await page.click(sel);
    await page.type(sel, lot ?? '');
    report.step('Name the lot to ship', (await page.$eval(sel, (el) => el.value)) === lot, `lot=${lot}`);
  }
  await clickText(page, 'Save & post');
  await waitUrlRe(page, new RegExp(`/sales/deliveries/${UUID}`), 20000);
  await sleep(1200);
  const delId = new RegExp(`/sales/deliveries/(${UUID})`).exec(page.url())?.[1] ?? '';
  const del = delId ? await api(page, `/sales/deliveries/${delId}`) : { body: {} };
  report.step('Create + post delivery', del.body?.status === 'posted', `${del.body?.number} status=${del.body?.status}`);

  ord = await api(page, `/sales/orders/${orderId}`);
  report.step('Order reflects the delivery', Number(ord.body?.lines?.[0]?.delivered_qty ?? 0) >= 100,
    `delivered_qty=${ord.body?.lines?.[0]?.delivered_qty} status=${ord.body?.status}`);

  // --- 6. Bill: the order's action prefills the invoice form ---
  await page.goto(`${BASE}/sales/orders/${orderId}`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await clickText(page, 'Bill', 'app-page-header');
  await waitUrl(page, '/sales/invoices/new', 15000);
  await sleep(1800);
  await clickText(page, 'Save & post');
  await waitUrlRe(page, new RegExp(`/sales/invoices/${UUID}`), 20000);
  await sleep(1200);
  const invId = new RegExp(`/sales/invoices/(${UUID})`).exec(page.url())?.[1] ?? '';
  let inv = invId ? await api(page, `/sales/invoices/${invId}`) : { body: {} };
  report.step('Create + post invoice', inv.body?.status === 'posted',
    `${inv.body?.number} total=${inv.body?.total} outstanding=${inv.body?.outstanding}`);

  // --- 7. Receive payment: the invoice's action prefills + auto-allocates ---
  await clickText(page, 'Receive payment', 'app-page-header');
  await waitUrl(page, '/sales/payments/new', 15000);
  await sleep(2500);
  await clickText(page, 'Save & post');
  await waitUrlRe(page, new RegExp(`/sales/payments/${UUID}`), 20000);
  await sleep(1200);
  const payId = new RegExp(`/sales/payments/(${UUID})`).exec(page.url())?.[1] ?? '';
  const pay = payId ? await api(page, `/sales/payments/${payId}`) : { body: {} };
  report.step('Create + post payment', pay.body?.status === 'posted', `${pay.body?.number} amount=${pay.body?.amount}`);

  inv = await api(page, `/sales/invoices/${invId}`);
  report.step('Invoice settled', inv.body?.settlement === 'paid' && Number(inv.body?.outstanding) === 0,
    `settlement=${inv.body?.settlement} outstanding=${inv.body?.outstanding}`);

  // --- 8. The invoice shows up in the register report ---
  await page.goto(`${BASE}/sales/reports`, { waitUntil: 'networkidle2' });
  await sleep(800);
  await clickText(page, 'Register');
  await sleep(800);
  await clickText(page, 'Run');
  await sleep(1500);
  const listed = await page.evaluate((num) => document.body.innerText.includes(num), inv.body?.number ?? '###');
  report.step('Invoice in the register report', listed, inv.body?.number);

  // --- 9. AR still reconciles and the GL outbox drained ---
  await sleep(2500); // let the GL port book the postings
  const recon = (await api(page, '/sales/reports/ar-reconciliation')).body ?? {};
  report.step('AR reconciles to the ledger',
    Math.abs(Number(recon.ar_gap ?? 0)) < 0.005 && Number(recon.pending_outbox ?? 0) === 0,
    `ar_open=${recon.ar_open} ledger=${recon.ar_account_balance} gap=${recon.ar_gap} pending_outbox=${recon.pending_outbox}`);
} catch (e) {
  report.step('FATAL', false, e.message);
}

await browser.close();
report.finish('ORDER TO CASH');
