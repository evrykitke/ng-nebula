// Every sales page renders: signs in, visits each route and asserts it draws a
// header with content and raises no console or runtime errors. Catches the
// wiring a compile cannot — missing routes, permission gates, proxy drift.
//
//   E2E_EMAIL=... E2E_PASSWORD=... npm run e2e:pages
import { signIn, sleep, reporter } from './harness.mjs';

const ROUTES = [
  ['Customers', '/sales/customers'],
  ['New customer', '/sales/customers/new'],
  ['Customer groups', '/sales/customer-groups'],
  ['Price lists', '/sales/price-lists'],
  ['New price list', '/sales/price-lists/new'],
  ['Quotations', '/sales/quotations'],
  ['New quotation', '/sales/quotations/new'],
  ['Sales orders', '/sales/orders'],
  ['New sales order', '/sales/orders/new'],
  ['Deliveries', '/sales/deliveries'],
  ['New delivery', '/sales/deliveries/new'],
  ['Sales invoices', '/sales/invoices'],
  ['New invoice', '/sales/invoices/new'],
  ['Credit notes', '/sales/credit-notes'],
  ['New credit note', '/sales/credit-notes/new'],
  ['Customer payments', '/sales/payments'],
  ['Record payment', '/sales/payments/new'],
  ['Sales reports', '/sales/reports'],
];

const BASE = process.env.E2E_BASE ?? 'http://localhost:4200';
const report = reporter();
const { browser, page, signedIn } = await signIn();
report.step('Sign in', signedIn, page.url());

// Collect console/runtime errors per page; ignore transport noise.
const seen = [];
page.on('console', (m) => m.type() === 'error' && seen.push(m.text()));
page.on('pageerror', (e) => seen.push('PAGEERROR: ' + e.message));
const drain = () => seen.splice(0).filter((x) => !/favicon|net::ERR_|Failed to load resource/.test(x));

if (signedIn) {
  for (const [name, route] of ROUTES) {
    drain();
    let ok = true;
    let detail = '';
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 45000 });
      await sleep(900);
      const info = await page.evaluate(() => ({
        title: document.querySelector('app-page-header h1, app-page-header h2, h1')?.textContent?.trim() ?? null,
        bodyLen: document.body.innerText.trim().length,
        hardError: /Cannot read|undefined is not|ExpressionChanged|NG0/.test(document.body.innerText),
      }));
      detail = `title="${info.title ?? '∅'}" bodyLen=${info.bodyLen}`;
      if (!info.title) { ok = false; detail += ' — NO HEADER'; }
      if (info.bodyLen < 40) { ok = false; detail += ' — EMPTY BODY'; }
      if (info.hardError) { ok = false; detail += ' — RUNTIME ERROR TEXT'; }
    } catch (e) {
      ok = false;
      detail = 'navigation failed: ' + e.message;
    }
    const errs = drain();
    if (errs.length) ok = false;
    report.step(name, ok, detail);
    for (const e of errs) console.log(`        ! ${e.slice(0, 200)}`);
  }
}

await browser.close();
report.finish('SALES PAGES');
