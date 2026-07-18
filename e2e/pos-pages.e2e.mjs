// POS pages end-to-end: the back-office pages render, and the till sells —
// open a session, ring a sale, read the X, close with a denomination count.
// Run with ng serve + nebula-server up and E2E_EMAIL / E2E_PASSWORD set.
import {
  BASE,
  api,
  clickText,
  reporter,
  signIn,
  sleep,
  waitUrl,
} from './harness.mjs';

const r = reporter();
const { browser, page, signedIn } = await signIn();
r.step('sign in', signedIn, page.url());
if (!signedIn) r.finish('pos-pages');

// ---------------------------------------------------------------------------
// Fixtures via the API: a register with sellable stock behind it.
// ---------------------------------------------------------------------------
const regs = await api(page, '/pos/registers');
r.step('list registers', regs.status === 200, `${regs.body.length ?? 0} registers`);
let register = (regs.body ?? []).find((x) => x.code === 'SMOKE-1') ?? (regs.body ?? [])[0];
if (!register) {
  const wh = await api(page, '/inventory/warehouses');
  const first = (wh.body ?? [])[0];
  const created = await api(page, '/pos/registers', 'POST', {
    code: 'E2E-1',
    name: 'E2E counter',
    warehouse_id: first?.id,
  });
  register = created.body;
  r.step('create fixture register', created.status === 200, register?.code ?? '');
}

// An item the till can actually sell, to type into the search bar.
const cat = await api(page, `/pos/catalog?register_id=${register.id}`);
const item = (cat.body.items ?? []).find(
  (i) =>
    Number(i.on_hand) > 2 &&
    Number(i.price) > 0 &&
    (!i.track_batches || i.batches.length > 0),
);
r.step('catalog has a sellable item', !!item, item ? `${item.name} @ ${item.price}` : 'none');

// If the register still holds an open session (a crashed earlier run), use it.
const existing = await api(page, `/pos/sessions/current?register_id=${register.id}`);
const hadOpenSession = existing.status === 200 && existing.body && existing.body.id;

// ---------------------------------------------------------------------------
// The back-office pages render.
// ---------------------------------------------------------------------------
for (const [path, marker] of [
  ['/pos/registers', 'Registers'],
  ['/pos/sessions', 'Sessions'],
  ['/pos/receipts', 'Receipts'],
  ['/pos/reports', 'POS reports'],
  ['/pos/settings', 'POS settings'],
]) {
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1200);
  const ok = await page.evaluate(
    (marker) => document.body.innerText.includes(marker),
    marker,
  );
  r.step(`page ${path}`, ok);
}

// The settings page grew paper + M-Pesa policy cards.
await page.goto(BASE + '/pos/settings', { waitUntil: 'networkidle2' });
await sleep(1200);
const settingsBody = await page.evaluate(() => document.body.innerText);
r.step(
  'settings show paper and M-Pesa policy',
  settingsBody.includes('Receipt paper') && settingsBody.includes('M-Pesa confirmation code'),
);

// The reports tabs answer.
await page.goto(BASE + '/pos/reports', { waitUntil: 'networkidle2' });
await clickText(page, 'Tender mix');
await sleep(1500);
const mixOk = await page.evaluate(() => document.body.innerText.includes('Net takings') || document.body.innerText.includes('No takings'));
r.step('tender mix tab', mixOk);

// ---------------------------------------------------------------------------
// The till: pick the register, open, sell, X, close.
// ---------------------------------------------------------------------------
await page.goto(BASE + '/pos/till', { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(1500);

// The pick screen only appears when several registers exist and none is
// remembered; land wherever the till put us and steer from there.
const body = () => page.evaluate(() => document.body.innerText);
// Wait out the boot screen before deciding which screen we landed on.
for (let i = 0; i < 20 && (await body()).includes('Waking the till'); i++) await sleep(500);
if ((await body()).includes('Which counter is this?')) {
  await clickText(page, register.name);
  await sleep(1500);
}
if (!hadOpenSession && (await body()).includes('Open the till')) {
  await page.click('#opening-float');
  await page.type('#opening-float', '1000');
  const typed = await page.$eval('#opening-float', (el) => el.value);
  r.step('float typed', typed === '1000', typed);
  await clickText(page, 'Open session');
  await sleep(2000);
}
const selling = (await body()).includes('Charge');
r.step('till reaches the sell screen', selling);

// Ring one sale: search → Enter → Charge → exact cash → confirm.
if (selling && item) {
  await page.click('input[placeholder*="Scan"]');
  await page.type('input[placeholder*="Scan"]', item.name);
  await sleep(600);
  await page.keyboard.press('Enter');
  await sleep(600);
  const carted = await page.evaluate(
    (name) => document.body.innerText.includes(name),
    item.name,
  );
  r.step('item lands in the cart', carted);

  // Type a quantity straight into the line's count.
  const qtyBox = await page.$('input[aria-label=Quantity]');
  await qtyBox.click({ clickCount: 3 });
  await qtyBox.type('3');
  await page.keyboard.press('Enter');
  await sleep(500);
  const qty3 = await page.evaluate(() => document.body.innerText.includes('3 ×'));
  r.step('typed quantity sticks', qty3);

  await clickText(page, 'Charge');
  await sleep(800);
  r.step('tender screen', /remaining/i.test(await body()));

  await clickText(page, 'Exact');
  await sleep(800);
  await clickText(page, 'Confirm');
  await sleep(2500);
  const done = await body();
  const receiptNo = (done.match(/RCP-\d{4}-\d+/) ?? [])[0] ?? '';
  r.step('sale captured', done.includes('New sale'), receiptNo);

  await clickText(page, 'New sale');
  await sleep(800);

  // The X report modal.
  await clickText(page, 'Menu');
  await clickText(page, 'X report');
  await sleep(1500);
  const x = await body();
  r.step('X report shows', x.includes('Where the drawer stands') || x.includes('Gross sales'));
  await page.keyboard.press('Escape');
  await sleep(500);

  // Close: sheet on, prefill from expected, close, books updated.
  await clickText(page, 'Menu');
  await clickText(page, 'Close session');
  await sleep(1500);
  r.step('close wizard', (await body()).includes('Close the session'));
  // Count in plain amounts: uncheck the sheet, copy each expectation into its
  // counted box, and leave a note anyway — simplest deterministic close.
  await page.evaluate(() => {
    const sheetToggle = [...document.querySelectorAll('input[type=checkbox]')][0];
    if (sheetToggle && sheetToggle.checked) sheetToggle.click();
  });
  await sleep(400);
  const expectations = await page.evaluate(() =>
    [...document.querySelectorAll('p')]
      .filter((p) => p.textContent.includes('Expected:'))
      .map((p) => p.textContent.replace(/[^0-9.]/g, '')),
  );
  const countedInputs = await page.$$('input[name^=counted-]');
  for (let i = 0; i < countedInputs.length && i < expectations.length; i++) {
    await countedInputs[i].click({ clickCount: 3 });
    await countedInputs[i].type(expectations[i]);
  }
  await page.type('textarea', 'e2e close');
  await clickText(page, 'Close the session');
  await sleep(4000);
  const closed = await body();
  const cleanClose = closed.includes('books updated');
  r.step('session closes into the books', cleanClose, cleanClose ? '' : closed.slice(0, 200));

  // The receipt reached the back office too.
  if (receiptNo) {
    await page.goto(BASE + '/pos/receipts', { waitUntil: 'networkidle2' });
    await sleep(1500);
    const listed = await page.evaluate(
      (no) => document.body.innerText.includes(no),
      receiptNo,
    );
    r.step('receipt listed in back office', listed, receiptNo);
  }
}

await browser.close();
r.finish('pos-pages');
