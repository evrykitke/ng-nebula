import { TableDataSource } from '../datatable/table-config';

/** One column of the lookup dropdown table. */
export interface LookupColumn<T = unknown> {
  label: string;
  /** Cell text for a row. */
  value: (row: T) => string;
  /** Optional fixed width, e.g. `'90px'`. */
  width?: string;
}

/**
 * Declarative configuration for `<app-lookup>` — the searchable
 * reference-picker input. Clicking the input opens a small server-driven table
 * anchored to it (above or below, wherever there is room); choosing a row puts
 * `display(row)` in the input and `key(row)` in the bound value.
 */
export interface LookupConfig<T = unknown> {
  /** Server search — same contract as the data table (the host owns the call). */
  dataSource: TableDataSource<T>;
  /** Columns shown in the dropdown table. */
  columns: LookupColumn<T>[];
  /** Stable row key — the value the input resolves to on select. */
  key: (row: T) => string;
  /** The text shown in the input once a row is selected. */
  display: (row: T) => string;
  /** Rows fetched per search (default 8). */
  pageSize?: number;
  /** Input placeholder while nothing is selected. */
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /**
   * Offer a quick-add action in the panel footer. The host declares the
   * actual modal and listens for the `quickAdd` output; after creating the
   * record it sets the lookup's `value`/`display` itself.
   */
  quickAdd?: boolean;
  /** Footer button label (default `'+ Add new'`). */
  quickAddLabel?: string;
}
