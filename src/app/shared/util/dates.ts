import { DateTime } from 'luxon';

/**
 * Render a DTO timestamp. The proxies revive ISO strings into luxon
 * `DateTime` (see fix-proxies.mjs), but tolerate a raw string anyway so a
 * missed conversion degrades to text — never to a thrown computed that
 * blanks the whole page.
 */
export function formatTimestamp(
  value: DateTime | string | null | undefined,
  fmt: string,
): string {
  const dt =
    value instanceof DateTime ? value : typeof value === 'string' ? DateTime.fromISO(value) : null;
  return dt?.isValid ? dt.toFormat(fmt) : value ? String(value) : '—';
}
