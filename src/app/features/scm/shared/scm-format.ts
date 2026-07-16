import { DateTime } from 'luxon';
import { BadgeTone } from '../../../shared/datatable/table-config';

/**
 * Formatting helpers shared by the SCM pages. The backend serializes every
 * decimal as a string; these parse and render them consistently so each page
 * does not reinvent number handling.
 */

/** Parse a backend decimal string ('' / null / undefined → 0). */
export function num(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Quantities: up to 3 decimals, trailing zeros trimmed. */
export function fmtQty(v: string | number | null | undefined): string {
  return num(v).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

/** Money: always 2 decimals. */
export function fmtMoney(v: string | number | null | undefined): string {
  return num(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Unit costs carry more precision than money (6dp on the backend). */
export function fmtCost(v: string | number | null | undefined): string {
  return num(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

/** Percentages already computed by the backend; '—' when absent. */
export function fmtPct(v: string | null | undefined): string {
  return v === null || v === undefined || v === '' ? '—' : `${num(v).toLocaleString()}%`;
}

export function fmtDate(d: DateTime | null | undefined): string {
  return d && d.isValid ? d.toFormat('yyyy-LL-dd') : '—';
}

export function fmtDateTime(d: DateTime | null | undefined): string {
  return d && d.isValid ? d.toFormat('yyyy-LL-dd HH:mm') : '—';
}

/**
 * A luxon date rendered back to the plain `YYYY-MM-DD` the backend's
 * NaiveDate fields expect. The generated proxies JSON.stringify request
 * bodies as-is, so the string passes through unchanged (same trick the
 * journal form uses).
 */
export function asDateString(d: DateTime): DateTime {
  return d.toFormat('yyyy-LL-dd') as unknown as DateTime;
}

// --- Status badge tones, one map per document lifecycle ---

export const moveStatusTones: Record<string, BadgeTone> = {
  draft: 'muted',
  posted: 'success',
  reversed: 'warning',
};

export const orderStatusTones: Record<string, BadgeTone> = {
  draft: 'muted',
  submitted: 'info',
  approved: 'info',
  partially_received: 'warning',
  received: 'success',
  closed: 'muted',
  cancelled: 'danger',
};

export const receiptStatusTones: Record<string, BadgeTone> = moveStatusTones;
export const returnStatusTones: Record<string, BadgeTone> = moveStatusTones;

export const invoiceStatusTones: Record<string, BadgeTone> = {
  draft: 'muted',
  posted: 'success',
  cancelled: 'danger',
};

export const paymentStatusTones: Record<string, BadgeTone> = moveStatusTones;

/** How much of a bill is settled by payments. */
export const settlementTones: Record<string, BadgeTone> = {
  unpaid: 'muted',
  partially_paid: 'warning',
  paid: 'success',
};

export const requisitionStatusTones: Record<string, BadgeTone> = {
  draft: 'muted',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
  converted: 'success',
  cancelled: 'muted',
};

export const rfqStatusTones: Record<string, BadgeTone> = {
  draft: 'muted',
  sent: 'info',
  closed: 'warning',
  awarded: 'success',
  cancelled: 'muted',
};

export const serialStatusTones: Record<string, BadgeTone> = {
  in_stock: 'success',
  issued: 'info',
  scrapped: 'danger',
};

// --- Sales (order-to-cash) lifecycles ---

export const quotationStatusTones: Record<string, BadgeTone> = {
  draft: 'muted',
  sent: 'info',
  accepted: 'success',
  declined: 'danger',
  expired: 'warning',
  converted: 'success',
};

export const salesOrderStatusTones: Record<string, BadgeTone> = {
  draft: 'muted',
  confirmed: 'info',
  partially_delivered: 'warning',
  delivered: 'success',
  closed: 'muted',
  cancelled: 'danger',
};

export const deliveryStatusTones: Record<string, BadgeTone> = moveStatusTones;
export const salesInvoiceStatusTones: Record<string, BadgeTone> = invoiceStatusTones;
export const creditNoteStatusTones: Record<string, BadgeTone> = invoiceStatusTones;
export const salesPaymentStatusTones: Record<string, BadgeTone> = moveStatusTones;

/** A price list's activation lifecycle. */
export const priceListStatusTones: Record<string, BadgeTone> = {
  draft: 'muted',
  active: 'success',
  archived: 'muted',
};

/** Human labels for the underscored statuses ('partially_received' → 'partially received'). */
export function statusLabel(s: string | null | undefined): string {
  return (s ?? '').replaceAll('_', ' ');
}
