// Report viewer on a phone: the PDF pages must fit the screen width
// (fit-to-width) instead of overflowing sideways, and a desktop window
// must still get the paper's natural size.
import { BASE, api, reporter, signIn, sleep } from './harness.mjs';

const r = reporter();
const { browser, page, signedIn } = await signIn();
r.step('signed in', signedIn, page.url());
if (!signedIn) {
  await browser.close();
  r.finish('report-viewer-mobile');
}

const reports = await api(page, '/reports');
const name = Array.isArray(reports.body) && reports.body[0]?.name;
r.step('report catalogue lists reports', !!name, name || JSON.stringify(reports.body).slice(0, 120));
if (!name) {
  await browser.close();
  r.finish('report-viewer-mobile');
}

async function firstCanvas(timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const m = await page.evaluate(() => {
      const c = document.querySelector('app-pdf-view canvas');
      if (!c) return null;
      const body = c.closest('.overflow-auto');
      return {
        canvas: c.getBoundingClientRect().width,
        bodyClient: body?.clientWidth ?? 0,
        bodyScroll: body?.scrollWidth ?? 0,
      };
    });
    if (m && m.canvas > 0) return m;
    await sleep(300);
  }
  return null;
}

// --- Phone ---
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(`${BASE}/workspace/reports/${encodeURIComponent(name)}`, {
  waitUntil: 'networkidle2',
  timeout: 60000,
});
const phone = await firstCanvas();
r.step('pdf renders on a phone', !!phone, phone ? `canvas ${Math.round(phone.canvas)}px` : '');
if (phone) {
  r.step(
    'page fits the phone width',
    phone.canvas <= phone.bodyClient && phone.bodyScroll <= phone.bodyClient + 1,
    `canvas ${Math.round(phone.canvas)}px in ${phone.bodyClient}px, scrollWidth ${phone.bodyScroll}`,
  );
}

// --- Desktop: natural size still ---
await page.setViewport({ width: 1400, height: 1000 });
await sleep(1200); // the resize observer repaints after a beat
const desk = await firstCanvas();
r.step('pdf renders on desktop', !!desk, desk ? `canvas ${Math.round(desk.canvas)}px` : '');
if (desk) {
  r.step(
    'desktop keeps the natural paper width',
    desk.canvas > 500,
    `canvas ${Math.round(desk.canvas)}px`,
  );
}

await browser.close();
r.finish('report-viewer-mobile');
