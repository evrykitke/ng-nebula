import { DateTime } from 'luxon';

/**
 * Load-time reader for `YYYY-MM-DD` fields off a proxy response.
 *
 * The generated proxies' JSON reviver only revives full ISO date-times, so
 * bare NaiveDate fields arrive as plain strings despite their declared
 * DateTime type — feeding one to a datepicker or an `isValid` check breaks.
 * Normalize through this before putting a response date into a form.
 */
export function asDate(d: DateTime | string | null | undefined): DateTime | undefined {
  if (d == null) return undefined;
  return typeof d === 'string' ? DateTime.fromISO(d) : d;
}
