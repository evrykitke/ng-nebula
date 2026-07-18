// Item master: create an item through the form, the way a user would —
// including typing into the numeric fields (prices, planning quantities).
// Regression: number inputs bind numbers into the model, and the save
// handler used to call .trim() on them and die silently.
import {
  BASE,
  UUID,
  api,
  clickText,
  formError,
  reporter,
  signIn,
  sleep,
  waitUrlRe,
} from './harness.mjs';

const r = reporter();
const { browser, page, signedIn } = await signIn();
r.step('signed in', signedIn, page.url());
if (!signedIn) {
  await browser.close();
  r.finish('item-create');
}

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto(`${BASE}/inventory/items/new`, { waitUntil: 'networkidle2', timeout: 60000 });
const onForm = await page
  .waitForSelector('input[name=sku]', { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
r.step('item form opens', onForm, page.url());

const sku = `E2E-${Date.now()}`;
await page.type('input[name=sku]', sku);
await page.type('input[name=name]', 'E2E crash-check item');

// Pick the stock unit through the lookup (first app-lookup on the page).
await page.click('app-lookup button');
const gotUom = await page
  .waitForSelector('.cdk-overlay-container tbody tr', { timeout: 10000 })
  .then(() => true)
  .catch(() => false);
r.step('uom lookup lists units', gotUom);
if (gotUom) await page.click('.cdk-overlay-container tbody tr');
await sleep(300);

// The numeric fields that used to blow up the save handler.
await page.type('input[name=standard_cost]', '10.5');
await page.type('input[name=selling_price]', '15.75');
await page.type('input[name=lead_time_days]', '3');

await clickText(page, 'Create item', 'form');
const created = await waitUrlRe(page, new RegExp(`/inventory/items/${UUID}$`), 15000);
r.step('item created and detail page opened', created, page.url());
r.step('no form error shown', !(await formError(page)), await formError(page));
r.step('no page errors', pageErrors.length === 0, pageErrors[0] ?? '');

// The backend must have the numbers the form promised.
if (created) {
  const list = await api(page, `/inventory/items?q=${sku}`);
  const item = Array.isArray(list.body) ? list.body.find((i) => i.sku === sku) : null;
  r.step('backend has the item', !!item);
  r.step(
    'numeric fields round-tripped',
    !!item && Number(item.standard_cost) === 10.5 && Number(item.selling_price) === 15.75 && item.lead_time_days === 3,
    item ? `cost=${item.standard_cost} sell=${item.selling_price} lead=${item.lead_time_days}` : '',
  );
  // Leave no fixture behind.
  if (item) await api(page, `/inventory/items/${item.id}`, 'DELETE');
}

await browser.close();
r.finish('item-create');
