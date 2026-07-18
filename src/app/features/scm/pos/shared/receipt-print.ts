import {
  CompanyProfileResponse,
  PosOrderView,
  Settings,
} from '../../../../shared/service-proxies/service-proxies';
import { fmtDateTime, fmtMoney, fmtQty, num } from '../../shared/scm-format';
import { tenderLabel } from './pos-format';

/**
 * Print a receipt to the tenant's configured paper. The POS settings say how
 * wide the roll is, how much margin the printer needs and how large the type
 * runs; this renders the order to exactly that geometry in a throwaway iframe
 * and hands it to the browser's print dialog, which drives the actual printer.
 *
 * The company block leads: the tenant's name and contacts identify whose
 * receipt this is; the register's own header (branch, till slogan) follows.
 */
export function printReceipt(
  order: PosOrderView,
  settings: Settings | null,
  company?: CompanyProfileResponse | null,
  header?: string | null,
  footer?: string | null,
): void {
  const width = settings?.receipt_paper_width_mm ?? 80;
  const margin = settings?.receipt_margin_mm ?? 4;
  const font = settings?.receipt_font_size_px ?? 12;

  const esc = (s: string | null | undefined): string =>
    (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const row = (left: string, right: string, cls = ''): string =>
    `<div class="row${cls ? ' ' + cls : ''}"><span>${left}</span><span class="num">${right}</span></div>`;

  // Which company fields show — everything, until the settings say otherwise.
  const show = (flag: boolean | undefined): boolean => flag !== false;

  const parts: string[] = [];
  if (company) {
    const block: string[] = [];
    if (show(settings?.receipt_show_company_name)) {
      block.push(`<p class="c b" style="font-size:${font + 2}px">${esc(company.display_name)}</p>`);
    }
    if (show(settings?.receipt_show_address) && company.address) {
      block.push(`<p class="c pre">${esc(company.address)}</p>`);
    }
    if (show(settings?.receipt_show_contacts)) {
      const contacts = [company.phone, company.email].filter(Boolean).join(' · ');
      if (contacts) block.push(`<p class="c">${esc(contacts)}</p>`);
    }
    if (show(settings?.receipt_show_tax_ids)) {
      const taxIds = [
        company.tax_pin ? `PIN ${company.tax_pin}` : '',
        company.vat_number ? `VAT ${company.vat_number}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      if (taxIds) block.push(`<p class="c">${esc(taxIds)}</p>`);
    }
    if (block.length) parts.push(...block, '<div class="rule"></div>');
  }
  if (header) parts.push(`<p class="c pre">${esc(header)}</p><div class="rule"></div>`);
  parts.push(`<p class="c b">${esc(order.number)}</p>`);
  parts.push(`<p class="c">${esc(fmtDateTime(order.sold_at))}</p>`);
  parts.push('<div class="rule"></div>');
  for (const l of order.lines ?? []) {
    parts.push(row(`${esc(fmtQty(l.qty))}&times; ${esc(l.description)}`, esc(fmtMoney(l.net))));
  }
  parts.push('<div class="rule"></div>');
  parts.push(row('TOTAL', `${esc(fmtMoney(order.total))} ${esc(order.currency)}`, 'b'));
  parts.push(row('VAT inside', esc(fmtMoney(order.tax_total))));
  for (const p of order.payments ?? []) {
    parts.push(row(esc(tenderLabel(p.tender)), esc(fmtMoney(p.tendered ?? p.amount))));
  }
  if (num(order.change) > 0) parts.push(row('Change', esc(fmtMoney(order.change))));
  if (footer) parts.push(`<div class="rule"></div><p class="c pre">${esc(footer)}</p>`);

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(order.number)}</title>
<style>
@page { size: ${width}mm auto; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${width}mm; }
body { font: ${font}px/1.45 'Courier New', monospace; color: #000; padding: ${margin}mm; }
.c { text-align: center; }
.b { font-weight: 700; }
.pre { white-space: pre-line; }
.row { display: flex; justify-content: space-between; gap: 6px; }
.row > span:first-child { min-width: 0; overflow-wrap: anywhere; }
.num { white-space: nowrap; font-variant-numeric: tabular-nums; }
.rule { border-top: 1px dashed #000; margin: ${Math.round(font / 2)}px 0; }
</style></head><body>${parts.join('')}</body></html>`;

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
  // The dialog blocks in most browsers; a minute covers the ones where it doesn't.
  setTimeout(() => frame.remove(), 60_000);
}
