// Shared helpers for the browser-driven end-to-end checks.
//
// These drive a real Chrome against a running dev stack (ng serve + the nebula
// server) rather than mocking: the point is to catch the wiring the unit build
// cannot see — routes, permissions, proxy shapes and the backend's own rules.
//
// Credentials and the browser path come from the environment so nothing
// personal lands in the repo:
//
//   E2E_EMAIL, E2E_PASSWORD   the account to sign in as (required)
//   E2E_BASE                  frontend origin (default http://localhost:4200)
//   E2E_API                   backend origin  (default http://localhost:5000)
//   E2E_CHROME                path to a Chrome/Edge binary (default: Windows Chrome)
//   E2E_HEADLESS=0            watch the run in a real window
import puppeteer from 'puppeteer-core';

export const BASE = process.env.E2E_BASE ?? 'http://localhost:4200';
export const API = process.env.E2E_API ?? 'http://localhost:5000';
const CHROME = process.env.E2E_CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A uuid, for telling `/sales/orders/<id>` from `/sales/orders/new`. */
export const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Collects pass/fail steps and prints them as they happen. */
export function reporter() {
  const steps = [];
  return {
    step(name, ok, detail = '') {
      steps.push({ name, ok, detail });
      console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
    },
    /** Print the tally and exit non-zero when anything failed. */
    finish(title) {
      const pass = steps.filter((s) => s.ok).length;
      const fail = steps.length - pass;
      console.log(`\n=== ${title}: ${pass} passed, ${fail} failed ===`);
      process.exit(fail ? 1 : 0);
    },
  };
}

/** Launch Chrome and sign in; returns the browser and a logged-in page. */
export async function signIn() {
  if (!EMAIL || !PASSWORD) {
    console.error('E2E_EMAIL and E2E_PASSWORD must be set (see e2e/harness.mjs).');
    process.exit(2);
  }
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: process.env.E2E_HEADLESS === '0' ? false : 'new',
    args: ['--no-sandbox', '--window-size=1400,1000'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('input[name=login]', { timeout: 30000 });
  await page.type('input[name=login]', EMAIL);
  await page.type('input[name=password]', PASSWORD);
  await Promise.all([
    page.click('button[type=submit]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}),
  ]);
  await sleep(2000);
  return { browser, page, signedIn: !page.url().includes('/login') };
}

/**
 * Click the first visible button/link whose text contains `text`, optionally
 * scoped to a container (pass 'app-page-header' so a sidebar link named
 * "Deliveries" cannot swallow a "Deliver" action).
 *
 * Visibility is `getClientRects()`, not `offsetParent`: the latter is null for
 * the fixed-position modal overlay.
 */
export async function clickText(page, text, within = null, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const hit = await page.evaluate(
      (text, within) => {
        const root = within ? document.querySelector(within) : document;
        if (!root) return false;
        const el = [...root.querySelectorAll('button, a')].find(
          (x) => x.getClientRects().length > 0 && x.textContent.trim().toLowerCase().includes(text.toLowerCase()),
        );
        if (el) { el.click(); return true; }
        return false;
      },
      text,
      within,
    );
    if (hit) return true;
    await sleep(250);
  }
  return false;
}

/** Click a button inside the most recently opened `<app-modal>`. */
export async function clickInModal(page, text, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const hit = await page.evaluate((text) => {
      const btns = [...document.querySelectorAll('app-modal button')].filter(
        (b) => b.getClientRects().length > 0 && b.textContent.trim().toLowerCase().includes(text.toLowerCase()),
      );
      if (btns.length) { btns[btns.length - 1].click(); return true; }
      return false;
    }, text);
    if (hit) return true;
    await sleep(250);
  }
  return false;
}

/**
 * Call the API as the signed-in user, reusing the app's own session and
 * `X-Tenant` header. Used to arrange fixtures and to assert the backend state
 * a UI action actually produced.
 */
export async function api(page, path, method = 'GET', body = null) {
  return page.evaluate(
    async (API, path, method, body) => {
      const s = JSON.parse(localStorage.getItem('pylon.session') || '{}');
      const tenant = localStorage.getItem('pylon.tenant');
      const r = await fetch(API + path, {
        method,
        headers: {
          Authorization: `Bearer ${s.accessToken}`,
          'X-Tenant': tenant || '',
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const raw = await r.text();
      let parsed;
      try { parsed = JSON.parse(raw); } catch { parsed = raw; }
      return { status: r.status, body: parsed };
    },
    API, path, method, body,
  );
}

export async function waitUrl(page, fragment, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (page.url().includes(fragment)) return true;
    await sleep(200);
  }
  return false;
}

export async function waitUrlRe(page, re, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (re.test(page.url())) return true;
    await sleep(200);
  }
  return false;
}

/** The visible validation message on a form, if any. */
export async function formError(page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('.text-destructive')].find(
      (x) => x.getClientRects().length > 0 && x.textContent.trim(),
    );
    return el ? el.textContent.trim().slice(0, 200) : '';
  });
}
