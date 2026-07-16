// "Export PDF" on the SCM list pages, driven through the real tools menu.
//
// Each list is opened, the kebab menu is used exactly as a user would, and the
// file Chrome actually downloads is checked for the PDF magic bytes. That is
// the whole chain: table config → visible columns → the server's Typst render.
//
//   E2E_EMAIL=... E2E_PASSWORD=... npm run e2e:export
//
// Read-only: an export writes nothing but the downloaded file.
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE, clickText, reporter, signIn, sleep } from './harness.mjs';

/** Every SCM list that offers an export, and the title it should carry. */
const LISTS = [
  ['/inventory/items', 'items'],
  ['/inventory/warehouses', 'warehouses'],
  ['/inventory/stock/levels', 'stock-levels'],
  ['/inventory/movements', 'stock-movements'],
  ['/procurement/suppliers', 'suppliers'],
  ['/procurement/requisitions', 'purchase-requisitions'],
  ['/procurement/rfqs', 'requests-for-quotation'],
  ['/procurement/orders', 'purchase-orders'],
  ['/procurement/receipts', 'goods-receipts'],
  ['/procurement/invoices', 'purchase-invoices'],
  ['/procurement/payments', 'supplier-payments'],
  ['/procurement/returns', 'purchase-returns'],
  ['/sales/customers', 'customers'],
  ['/sales/price-lists', 'price-lists'],
  ['/sales/quotations', 'quotations'],
  ['/sales/orders', 'sales-orders'],
  ['/sales/deliveries', 'delivery-notes'],
  ['/sales/invoices', 'sales-invoices'],
  ['/sales/credit-notes', 'credit-notes'],
  ['/sales/payments', 'customer-receipts'],
];

const report = reporter();
const dir = mkdtempSync(join(tmpdir(), 'pylon-export-'));
const { browser, page, signedIn } = await signIn();
report.step('Sign in', signedIn, page.url());
if (!signedIn) { await browser.close(); report.finish('LIST EXPORT'); }

// Downloads must land somewhere we can inspect rather than in the user's
// Downloads folder.
const cdp = await page.createCDPSession();
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });

/** Wait for a .pdf to finish downloading (Chrome writes .crdownload first). */
async function waitForPdf(timeout = 45000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const done = readdirSync(dir).filter((f) => f.endsWith('.pdf'));
    if (done.length && !readdirSync(dir).some((f) => f.endsWith('.crdownload'))) {
      const file = join(dir, done[0]);
      if (statSync(file).size > 0) return file;
    }
    await sleep(300);
  }
  return null;
}

try {
  for (const [route, expected] of LISTS) {
    for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true });

    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('app-data-table table', { timeout: 20000 }).catch(() => {});
    await sleep(1200);

    // The table footer states how many records the current filters select.
    const total = await page.evaluate(() => {
      const m = document.body.innerText.match(/(\d[\d,]*)\s+records/);
      return m ? Number(m[1].replace(/,/g, '')) : -1;
    });

    const opened = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Table tools"]');
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!opened) {
      report.step(`${route} — tools menu`, false, 'no tools button (is exportPdf set?)');
      continue;
    }
    await sleep(500);

    if (!(await clickText(page, 'Export PDF'))) {
      report.step(`${route} — Export PDF item`, false, 'menu item not found');
      continue;
    }

    // An empty list has nothing to render: the table must say so and download
    // nothing, rather than producing a page with a bare header. Read the count
    // from the table's own footer — scanning the rows for the empty-state text
    // false-positives on any boolean cell, which renders a literal "No".
    if (total === 0) {
      await sleep(800);
      const warned = await page.evaluate(() =>
        document.body.innerText.toLowerCase().includes('nothing to export'),
      );
      report.step(`${route} — empty list declines to export`, warned, 'no rows; warned instead');
      continue;
    }

    const file = await waitForPdf();
    if (!file) {
      report.step(`${route} — downloads a PDF`, false, 'no file arrived');
      continue;
    }
    const bytes = readFileSync(file);
    const name = file.split(/[\\/]/).pop();
    const isPdf = bytes.subarray(0, 5).toString('latin1') === '%PDF-';
    // The server names the file from the export's title, so the name proves
    // the right title travelled with it.
    const named = name.startsWith(expected);
    report.step(
      `${route} — downloads a PDF`,
      isPdf && named,
      `${name} (${bytes.length} bytes)${named ? '' : ` — expected to start with "${expected}"`}`,
    );
  }
} catch (e) {
  report.step('FATAL', false, e.message);
}

await browser.close();
rmSync(dir, { recursive: true, force: true });
report.finish('LIST EXPORT');
