/**
 * Report filters: the criteria a list offers when it prints.
 *
 * A list already knows what its columns are and how each one renders, so the
 * filter form is derived from the resolved `ColumnDef`s rather than declared a
 * second time per page. A date column asks for a range, a badge asks which
 * values to keep, a number asks for bounds, text asks for a fragment.
 *
 * These filter the copy of the rows being printed — never the screen. The
 * criteria are summarised onto the document, so a printed list says what it
 * was narrowed to.
 */
import { DateTime } from 'luxon';
import { ColumnDef } from './table-config';

/** How a column asks to be narrowed. */
export type FilterKind = 'choice' | 'dateRange' | 'numberRange' | 'text';

/**
 * What the criteria form needs to render one filter. Carries no row type, so
 * a `FilterField<Invoice>[]` can be handed to a form that knows nothing about
 * invoices — `ColumnDef<T>` is not assignable across row types (its accessors
 * take `T`), and the form never touches a row.
 */
export interface FilterFieldView {
  /** The column's field, which keys the criterion. */
  field: string;
  label: string;
  kind: FilterKind;
  /** For `choice`: the distinct cell values present. */
  options: string[];
}

/** One column's filter, plus the column itself for reading rows back. */
export interface FilterField<T = unknown> extends FilterFieldView {
  column: ColumnDef<T>;
}

/**
 * What the user typed for one field. Held as strings because that is what the
 * inputs bind to; an empty string means "not set" for every kind.
 */
export interface Criterion {
  chosen: string[];
  from: string;
  to: string;
  min: string;
  max: string;
  contains: string;
}

export function emptyCriterion(): Criterion {
  return { chosen: [], from: '', to: '', min: '', max: '', contains: '' };
}

/** Whether the user actually asked this field for anything. */
export function isActive(c: Criterion): boolean {
  return !!(c.chosen.length || c.from || c.to || c.min || c.max || c.contains.trim());
}

/** Reads a cell as the user sees it — the same text the PDF prints. */
export type CellText<T> = (row: T, column: ColumnDef<T>) => string;

/**
 * The value a comparison should use: the row's own field, not the column's
 * display accessor.
 *
 * Lists routinely pre-format in the accessor — `col.number('total').value(i =>
 * fmtMoney(i.total))` hands back `'1,234.56'`, a string no arithmetic can use,
 * and a date column often hands back a rendered day. The field beside it still
 * holds the real number or timestamp, so that is what gets compared. Columns
 * with no such field (a purely computed cell) fall back to the accessor.
 */
function underlying<T>(row: T, column: ColumnDef<T>): unknown {
  const own = (row as Record<string, unknown>)[column.field];
  return own !== undefined ? own : column.value?.(row);
}

/** Whether a value is a date rather than something that merely parses as one. */
function isDateLike(value: unknown): boolean {
  if (value instanceof DateTime || value instanceof Date) return true;
  // Only an ISO-ish date counts: a text column holding `SINV-2026-00003` must
  // not be mistaken for one.
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);
}

/**
 * How a column asks to be narrowed.
 *
 * The declared type decides it, except for text columns: a page that formats a
 * date into a text column still deserves a date range, and its field gives the
 * game away. Sniffing the rows is what makes that possible.
 */
function kindOf<T>(column: ColumnDef<T>, rows: T[]): FilterKind | null {
  switch (column.type) {
    case 'date':
    case 'datetime':
      return 'dateRange';
    case 'badge':
    case 'boolean':
      return 'choice';
    case 'number':
    case 'currency':
      return 'numberRange';
    case 'text':
    case 'email': {
      const present = rows.map((r) => underlying(r, column)).filter((v) => v !== null && v !== undefined && v !== '');
      return present.length && present.every(isDateLike) ? 'dateRange' : 'text';
    }
    // An image is a thumbnail; there is nothing to narrow by.
    default:
      return null;
  }
}

/**
 * The filters a set of columns offers over a set of rows.
 *
 * The choices come from the rows in hand rather than from the column's declared
 * tones, so the form only ever offers values that would actually match — a
 * status no row holds is not worth a checkbox. A choice column whose rows are
 * all one value is dropped for the same reason: it cannot narrow anything.
 */
export function filterFields<T>(
  columns: ColumnDef<T>[],
  rows: T[],
  text: CellText<T>,
): FilterField<T>[] {
  const fields: FilterField<T>[] = [];
  for (const column of columns) {
    const kind = kindOf(column, rows);
    if (!kind) continue;
    let options: string[] = [];
    if (kind === 'choice') {
      const seen = new Set<string>();
      for (const row of rows) {
        const v = text(row, column);
        if (v && v !== '—') seen.add(v);
      }
      if (seen.size < 2) continue;
      options = [...seen].sort((a, b) => a.localeCompare(b));
    }
    fields.push({ field: column.field, label: column.label, kind, options, column });
  }
  return fields;
}

/** A cell's value as a date, or null when it holds none. */
function asDate(value: unknown): DateTime | null {
  const dt =
    value instanceof DateTime
      ? value
      : typeof value === 'string'
        ? DateTime.fromISO(value)
        : value instanceof Date
          ? DateTime.fromJSDate(value)
          : null;
  return dt?.isValid ? dt : null;
}

/** A cell's value as a number, or null when it holds none. */
function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Whether one row satisfies one field's criterion.
 *
 * Choices and text compare what the reader sees — the same string the PDF
 * prints, so a status reads `Posted` in both places. Dates and numbers compare
 * the underlying field, because the rendered cell is prose.
 */
function matches<T>(row: T, field: FilterField<T>, c: Criterion, text: CellText<T>): boolean {
  switch (field.kind) {
    case 'choice':
      return !c.chosen.length || c.chosen.includes(text(row, field.column));
    case 'text': {
      const needle = c.contains.trim().toLowerCase();
      return !needle || text(row, field.column).toLowerCase().includes(needle);
    }
    case 'dateRange': {
      const d = asDate(underlying(row, field.column));
      // A row with no date cannot fall inside a range the user asked for.
      if (!d) return !c.from && !c.to;
      if (c.from && d.startOf('day') < DateTime.fromISO(c.from).startOf('day')) return false;
      if (c.to && d.startOf('day') > DateTime.fromISO(c.to).startOf('day')) return false;
      return true;
    }
    case 'numberRange': {
      const n = asNumber(underlying(row, field.column));
      if (n === null) return !c.min && !c.max;
      if (c.min && n < Number(c.min)) return false;
      if (c.max && n > Number(c.max)) return false;
      return true;
    }
  }
}

/** The rows that satisfy every active criterion. */
export function applyFilters<T>(
  rows: T[],
  fields: FilterField<T>[],
  values: Record<string, Criterion>,
  text: CellText<T>,
): T[] {
  const active = fields.filter((f) => isActive(values[f.field] ?? emptyCriterion()));
  if (!active.length) return rows;
  return rows.filter((row) => active.every((f) => matches(row, f, values[f.field], text)));
}

/** A date for a reader: `16-Jul-2026`, never an all-numeric coin toss. */
function readable(iso: string): string {
  const d = DateTime.fromISO(iso);
  return d.isValid ? d.toFormat('dd-LLL-yyyy') : iso;
}

/**
 * The criteria in words, for the document's subtitle — one phrase per field
 * the user actually set, so the page states what it was narrowed to.
 */
export function summarize(fields: FilterFieldView[], values: Record<string, Criterion>): string[] {
  const bits: string[] = [];
  for (const f of fields) {
    const c = values[f.field];
    if (!c || !isActive(c)) continue;
    const label = f.label;
    switch (f.kind) {
      case 'choice':
        bits.push(`${label}: ${c.chosen.join(', ')}`);
        break;
      case 'text':
        bits.push(`${label} contains “${c.contains.trim()}”`);
        break;
      case 'dateRange':
        if (c.from && c.to) bits.push(`${label}: ${readable(c.from)} to ${readable(c.to)}`);
        else if (c.from) bits.push(`${label}: from ${readable(c.from)}`);
        else bits.push(`${label}: up to ${readable(c.to)}`);
        break;
      case 'numberRange':
        if (c.min && c.max) bits.push(`${label}: ${c.min} to ${c.max}`);
        else if (c.min) bits.push(`${label}: at least ${c.min}`);
        else bits.push(`${label}: at most ${c.max}`);
        break;
    }
  }
  return bits;
}
