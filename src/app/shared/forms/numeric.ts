/**
 * Save-time readers for form fields bound to `<input type="number">`.
 *
 * Angular's NumberValueAccessor writes a number — or null, once the user
 * clears the field — into the model even when the property is declared as
 * a string, so a save handler must never call string methods on such a
 * field directly. Read the field through these instead.
 */

/** The field as trimmed text; '' when empty, cleared (null) or untouched. */
export function fieldText(v: string | number | null | undefined): string {
  return v == null ? '' : String(v).trim();
}

/** A decimal as the API wants it (a string); undefined when blank. */
export function optDec(v: string | number | null | undefined): string | undefined {
  const s = fieldText(v);
  return s === '' ? undefined : s;
}

/** An integer (counts, days); undefined when blank. */
export function optInt(v: string | number | null | undefined): number | undefined {
  const s = fieldText(v);
  return s === '' ? undefined : Number(s);
}
