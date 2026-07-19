// Stock movement form: create a receipt draft, edit it, post it — plus the
// mobile layout rules (header actions stack under the title, line-item inputs
// keep a usable width and the table scrolls sideways instead).
//
// Unlike the other checks this one registers its own throwaway tenant
// (`E2E_TENANT`, with `E2E_EMAIL`/`E2E_PASSWORD` as its admin), so it never
// touches an existing tenant's stock. **Writes records** — dev stack only.
//
// The draft round trip exists because of a real regression: bare `YYYY-MM-DD`
// dates come off the proxies as strings (the reviver only revives full ISO
// date-times), which broke the datepicker and failed the edit form with
// "A valid date is required".
import {
  BASE, API, api, clickText, formError, reporter, signIn, sleep, waitUrlRe, UUID,
} from './harness.mjs';

const R = reporter();

const tenant = process.env.E2E_TENANT ?? `movee2e${Date.now().toString(36)}`;
const reg = await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenant_name: tenant,
    company_display_name: `Move E2E ${tenant}`,
    email: process.env.E2E_EMAIL,
    password: process.env.E2E_PASSWORD,
    first_name: 'Move',
    last_name: 'Tester',
  }),
});
R.step('register tenant', reg.ok, reg.ok ? tenant : (await reg.text()).slice(0, 200));
if (!reg.ok) R.finish('move-form');

const { browser, page, signedIn } = await signIn();
R.step('sign in', signedIn, page.url());

// -- Fixtures: the seeded UoM + MAIN warehouse, and one plain item.
const uoms = await api(page, '/inventory/uoms');
const uomId = Array.isArray(uoms.body) ? uoms.body[0]?.id : undefined;
R.step('uom available', !!uomId, uomId ?? JSON.stringify(uoms.body).slice(0, 120));
const wh = await api(page, '/inventory/warehouses', 'POST', { code: 'MAIN', name: 'Main store' });
R.step('warehouse available', wh.status === 200 || wh.status === 409);
const item = await api(page, '/inventory/items', 'POST', { sku: 'WIDGET', name: 'Widget', uom_id: uomId });
R.step('item created', item.status === 200, JSON.stringify(item.body).slice(0, 120));

/** Open the lookup behind `triggerSel` and click the row containing `text`. */
async function pickLookup(p, triggerSel, text) {
  await p.click(triggerSel);
  for (let i = 0; i < 20; i++) {
    await sleep(300);
    const ok = await p.evaluate((text) => {
      const rows = [...document.querySelectorAll('.cdk-overlay-container tbody tr')].filter(
        (r) => r.getClientRects().length > 0 && r.textContent.includes(text),
      );
      if (rows.length) { rows[0].click(); return true; }
      return false;
    }, text);
    if (ok) return true;
  }
  return false;
}

// NgModel claims the bound `[name]`, so the DOM attribute stays empty —
// line inputs are addressed by cell position, not by name.
const QTY = 'table tbody tr td:nth-child(2) input';
const COST = 'table tbody tr td:nth-child(3) input';

// -- New receipt: fill and save a draft.
await page.goto(`${BASE}/inventory/movements/new/receipt`, { waitUntil: 'networkidle2' });
await page.waitForSelector('app-datepicker button', { timeout: 15000 });
const newDate = await page.$eval('app-datepicker button span', (el) => el.textContent.trim());
R.step('new form shows a date', /\d{2} \w{3} \d{4}/.test(newDate), newDate);

R.step('pick to-warehouse', await pickLookup(page, 'form .grid app-lookup button', 'MAIN'));
R.step('pick item', await pickLookup(page, 'table tbody app-lookup button', 'WIDGET'));
await page.type(QTY, '5');
await page.type(COST, '100');
await page.type('input[name=memo]', 'E2E receipt of widgets');
await clickText(page, 'Save draft', 'form');
const navigated = await waitUrlRe(page, new RegExp(`/inventory/movements/${UUID}$`), 15000);
R.step('draft saved (no form error)', navigated && !(await formError(page)), (await formError(page)) || page.url());
if (!navigated) { await browser.close(); R.finish('move-form'); }
const moveId = page.url().match(new RegExp(UUID))?.[0];

// -- Edit the draft: date, qty and cost must survive the round trip.
await page.goto(`${BASE}/inventory/movements/${moveId}/edit`, { waitUntil: 'networkidle2' });
await page.waitForSelector('app-datepicker button', { timeout: 15000 });
await sleep(1000);
const editDate = await page.$eval('app-datepicker button span', (el) => el.textContent.trim());
R.step('edit form shows the saved date', /\d{2} \w{3} \d{4}/.test(editDate), editDate);
R.step('edit form keeps the unit cost', (await page.$eval(COST, (el) => el.value)) !== '');
R.step('edit form keeps the qty', (await page.$eval(QTY, (el) => el.value)) !== '');

// Post straight from the loaded draft — no retyping anything.
await clickText(page, 'Save & post', 'form');
const posted = await waitUrlRe(page, new RegExp(`/inventory/movements/${UUID}$`), 15000);
await sleep(500);
R.step('posted from edit (no form error)', posted && !(await formError(page)), (await formError(page)) || page.url());

// -- Adjustment counting a fresh item up from zero: the backend demands a
// unit cost here (no average to inherit), so the form must offer the column
// on adjustments and send the value.
const item2 = await api(page, '/inventory/items', 'POST', { sku: 'GADGET', name: 'Gadget', uom_id: uomId });
R.step('second item created', item2.status === 200, JSON.stringify(item2.body).slice(0, 120));
await page.goto(`${BASE}/inventory/movements/new/adjustment`, { waitUntil: 'networkidle2' });
await page.waitForSelector('app-datepicker button', { timeout: 15000 });
R.step('pick warehouse', await pickLookup(page, 'form .grid app-lookup button', 'MAIN'));
R.step('pick gadget', await pickLookup(page, 'table tbody app-lookup button', 'GADGET'));
R.step('adjustment shows a cost column', !!(await page.$(COST)));
await page.type(QTY, '3');
await page.type(COST, '50');
await page.type('input[name=memo]', 'E2E count-in of gadgets');
await clickText(page, 'Save & post', 'form');
const adjPosted = await waitUrlRe(page, new RegExp(`/inventory/movements/${UUID}$`), 15000);
await sleep(500);
R.step('zero-stock adjustment posts with a cost', adjPosted && !(await formError(page)), (await formError(page)) || page.url());

// -- Mobile layout: header stacking and line-item input widths.
await page.setViewport({ width: 390, height: 844 });
await page.goto(`${BASE}/inventory/movements`, { waitUntil: 'networkidle2' });
await page.waitForSelector('app-page-header h1', { timeout: 15000 });
await sleep(800);
const stacked = await page.evaluate(() => {
  const h1 = document.querySelector('app-page-header h1');
  const actions = h1?.closest('div')?.nextElementSibling;
  if (!h1 || !actions || !actions.getClientRects().length) return { ok: false, why: 'missing nodes' };
  const a = h1.getBoundingClientRect();
  const b = actions.getBoundingClientRect();
  return { ok: b.top >= a.bottom - 1, why: `title bottom ${a.bottom.toFixed(0)}, actions top ${b.top.toFixed(0)}` };
});
R.step('mobile: actions stack under title', stacked.ok, stacked.why);

await page.goto(`${BASE}/inventory/movements/new/receipt`, { waitUntil: 'networkidle2' });
await page.waitForSelector(QTY, { timeout: 15000 });
await sleep(800);
const widths = await page.evaluate((QTY) => {
  const qty = document.querySelector(QTY);
  const lookup = document.querySelector('table tbody app-lookup');
  const scroller = qty?.closest('.overflow-x-auto');
  return {
    qty: qty?.getBoundingClientRect().width ?? 0,
    lookup: lookup?.getBoundingClientRect().width ?? 0,
    scrolls: scroller ? scroller.scrollWidth > scroller.clientWidth : false,
  };
}, QTY);
R.step('mobile: qty input usable', widths.qty >= 90, `${widths.qty.toFixed(0)}px`);
R.step('mobile: item lookup usable', widths.lookup >= 180, `${widths.lookup.toFixed(0)}px`);
R.step('mobile: lines table scrolls horizontally', widths.scrolls);

await browser.close();
R.finish('move-form');
