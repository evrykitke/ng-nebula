import { BadgeTone } from '../../../../shared/datatable/table-config';

/**
 * POS-specific vocabulary shared by the till and its back-office pages —
 * lifecycles and tender names, kept beside the general SCM number/date
 * helpers in `../shared/scm-format`.
 */

/** The fixed v1 tender set, in the order the till offers them. */
export const TENDERS = ['cash', 'mpesa', 'card'] as const;
export type Tender = (typeof TENDERS)[number];

export function tenderLabel(t: string | null | undefined): string {
  return t === 'mpesa' ? 'M-Pesa' : t === 'card' ? 'Card' : t === 'cash' ? 'Cash' : (t ?? '');
}

/** `Closing` is a real resting state: counted but not yet consolidated. */
export const sessionStatusTones: Record<string, BadgeTone> = {
  open: 'success',
  closing: 'warning',
  closed: 'muted',
};

export const receiptStatusTones: Record<string, BadgeTone> = {
  captured: 'success',
  voided: 'danger',
};

export const receiptKindTones: Record<string, BadgeTone> = {
  sale: 'success',
  refund: 'warning',
};

/**
 * Greedy decomposition of an amount over a denomination set — the starting
 * point the count sheet offers, which the cashier then corrects to what the
 * drawer actually holds. Works in cents so 0.1 + 0.2 never betrays anyone.
 */
export function suggestSheet(
  amount: number,
  denominations: string[],
): Array<{ denom: string; count: number }> {
  let cents = Math.round(amount * 100);
  const sheet: Array<{ denom: string; count: number }> = [];
  for (const d of denominations) {
    const dc = Math.round(Number(d) * 100);
    if (dc <= 0) continue;
    const count = Math.floor(cents / dc);
    if (count > 0) {
      sheet.push({ denom: d, count });
      cents -= count * dc;
    }
  }
  return sheet;
}

/** Sum of a count sheet, in currency units. */
export function sheetTotal(sheet: Array<{ denom: string; count: number }>): number {
  const cents = sheet.reduce((n, r) => n + Math.round(Number(r.denom) * 100) * (r.count || 0), 0);
  return cents / 100;
}
