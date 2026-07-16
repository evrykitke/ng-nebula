// The "PDF" action on the SCM detail pages, driven through the real button.
//
// A list is opened, its first record is opened, and the file Chrome actually
// downloads is checked for the PDF magic bytes and for a name carrying the
// record's own number — the whole chain: detail page → ?id= → Typst render.
//
//   E2E_EMAIL=... E2E_PASSWORD=... npm run e2e:documents
//
// Read-only: rendering a document writes nothing but the downloaded file.
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE, reporter, signIn, sleep, UUID, waitUrlRe } from './harness.mjs';

/** Every SCM record that prints as a document, and the file name it earns. */
const DOCUMENTS = [
  ['/procurement/requisitions', 'req'],
  ['/procurement/orders', 'po'],
  ['/procurement/receipts', 'grn'],
  ['/procurement/invoices', 'pinv'],
  ['/procurement/returns', 'rts'],
  ['/sales/quotations', 'quo'],
  ['/sales/orders', 'so'],
  ['/sales/deliveries', 'dn'],
  ['/sales/invoices', 'sinv'],
  ['/sales/credit-notes', 'cn'],
];

const report = reporter();
const dir = mkdtempSync(join(tmpdir(), 'pylon-doc-'));
const { browser, page, signedIn } = await signIn();
report.step('Sign in', signedIn, page.url());
if (!signedIn) { await browser.close(); report.finish('DOCUMENT EXPORT'); }

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
  for (const [route, expected] of DOCUMENTS) {
    for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true });

    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('app-data-table table', { timeout: 20000 }).catch(() => {});
    await sleep(1200);

    // Open the first record through its row's own View action — the rows
    // aren't links and a bare row click navigates nowhere. A list with no
    // records can't prove anything here, so say so rather than passing quietly.
    const opened = await page.evaluate(() => {
      const row = document.querySelector('app-data-table tbody tr');
      const view = [...(row?.querySelectorAll('button') ?? [])].find(
        (b) => b.textContent.trim() === 'View',
      );
      if (!view) return false;
      view.click();
      return true;
    });
    if (!opened) {
      report.step(`${route} — has a record to print`, false, 'list is empty');
      continue;
    }
    if (!(await waitUrlRe(page, new RegExp(UUID)))) {
      report.step(`${route} — opens a record`, false, page.url());
      continue;
    }
    await sleep(800);

    // The button the user clicks, scoped to the header so a substring match
    // can't wander into the page body.
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector('app-page-header app-document-pdf button');
      if (!btn || btn.disabled) return false;
      btn.click();
      return true;
    });
    if (!clicked) {
      report.step(`${route} — has a PDF button`, false, 'missing or still disabled');
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
    // The server names the file after the document's number, which is what
    // someone filing it looks for — a generic name means the number was lost.
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
report.finish('DOCUMENT EXPORT');
