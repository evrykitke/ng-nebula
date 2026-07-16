/**
 * DataTable configuration model.
 *
 * Each entity that needs a list declares a `TableConfig` (columns, actions,
 * feature toggles). The reusable `<app-data-table>` renders it and drives a
 * `TableDataSource` — a function that turns a `TableQuery` (page/search/sort)
 * into a `TablePage`. Presentation lives here on the frontend; the backend only
 * needs a uniform list contract (`?page&size&search&sort&sort_dir`).
 */
import { Observable } from 'rxjs';

/** The cell renderers the table understands. */
export type ColumnType =
  | 'text'
  | 'email'
  | 'badge'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'number'
  | 'currency'
  | 'image';

/** Semantic badge tones mapped to theme classes by the component. */
export type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'muted';

/** A fully-resolved column definition (what the component consumes). */
export interface ColumnDef<T = unknown> {
  /** Row property this column reads (also the default backend sort key). */
  field: string;
  /** Header label. */
  label: string;
  /** Cell renderer. */
  type: ColumnType;
  /** Whether the header offers sorting. */
  sortable: boolean;
  /** Backend sort key when it differs from `field`. */
  sortField?: string;
  /** Initial visibility (can be toggled if `toggleable`). */
  visible: boolean;
  /** Whether the user may show/hide it via the column-toggle modal. */
  toggleable: boolean;
  /**
   * This column's width, e.g. `'120px'` — the last word on the matter.
   *
   * The table lays out fixed, so every column has a width whether it says so or
   * not. Left unset, the predictable types (date, number, currency, badge,
   * boolean, image) take the wider of what their content needs and what their
   * heading needs, and text columns share what is left.
   *
   * Set it when the content is narrower or wider than the type implies — a
   * currency *code* ('USD') in a text column, a SKU, a quantity that never
   * passes 999. Setting it on a text column takes that column out of the share
   * and hands the space to the others, which is usually the point.
   */
  width?: string;
  /** Horizontal cell alignment. */
  align?: 'left' | 'right' | 'center';
  /** For `badge`/`boolean`: value → tone. Boolean keys are `'true'`/`'false'`. */
  badgeColors?: Record<string, BadgeTone>;
  /** For `date`/`datetime`: a luxon format token. */
  format?: string;
  /** Custom accessor when the value is not a direct property. */
  value?: (row: T) => unknown;
  /** Custom string formatter (wins over the type renderer). */
  formatter?: (value: unknown, row: T) => string;
}

/** A per-row action button rendered in the actions column. */
export interface RowAction<T = unknown> {
  /** Stable key emitted on click. */
  key: string;
  /** Button label. */
  label: string;
  /** Optional ng-icon name. */
  icon?: string;
  /** Visual tone. */
  tone?: 'default' | 'danger';
  /** Hide the action for rows that fail this predicate. */
  visible?: (row: T) => boolean;
}

/** The declarative table configuration for one entity. */
export interface TableConfig<T = unknown> {
  /** Stable identifier, e.g. `'users'`. Namespaces persisted UI preferences. */
  id: string;
  /** Column definitions (or fluent builders — normalized by the component). */
  columns: Array<ColumnDef<T> | ColumnBuilder<T>>;
  /** Extracts a stable key per row (used by `@for` tracking and selection). */
  rowKey: (row: T) => string;
  /** Default sort field (backend key). */
  defaultSort?: string;
  /** Default sort direction. */
  defaultSortDir?: 'asc' | 'desc';
  /** Initial page size. */
  pageSize?: number;
  /** Selectable page sizes. */
  pageSizeOptions?: number[];
  /** Show the search box. */
  search?: boolean;
  /** Search box placeholder. */
  searchPlaceholder?: string;
  /** Show the column-visibility toggle in the tools menu. */
  columnToggle?: boolean;
  /**
   * Offer "Export PDF" in the tools menu. The table renders itself through
   * the server's reporting engine: every row the current search and filters
   * select (not just the page on screen), in the columns left visible by the
   * column toggle. So the toggle doubles as the export's column picker.
   */
  exportPdf?: boolean;
  /** The exported document's title. Defaults to a prettified `id`. */
  exportTitle?: string;
  /**
   * The exported document's subtitle — a function so it reads the page's
   * current filters at export time. The row count and search term are
   * appended automatically, so this should describe the filters only
   * (e.g. `'Status: confirmed'`).
   */
  exportSubtitle?: () => string;
  /** Page orientation. Defaults to landscape once a list is wide. */
  exportOrientation?: 'portrait' | 'landscape';
  /** Offer "Export CSV" in the tools menu (emits `exportCsv`). */
  exportCsv?: boolean;
  /** Offer "Import CSV" in the tools menu (emits `importCsv`). */
  importCsv?: boolean;
  /** Show selection checkboxes + bulk action bar. */
  multiSelect?: boolean;
  /**
   * Per-row actions. **Opt-in by design**: a table shows no row actions (and no
   * Delete) unless they are declared here — so destructive actions like delete
   * are never present by default and must be explicitly configured per entity.
   */
  actions?: RowAction<T>[];
  /** Message shown when there are no rows. */
  emptyText?: string;
}

/** The query the table emits to its data source. */
export interface TableQuery {
  page: number;
  size: number;
  search: string;
  sort: string | null;
  sortDir: 'asc' | 'desc';
}

/** A page of rows returned by a data source. */
export interface TablePage<T> {
  rows: T[];
  total: number;
}

/** Turns a query into a page of rows. The parent owns the actual proxy call. */
export type TableDataSource<T> = (query: TableQuery) => Observable<TablePage<T>>;

/**
 * Fluent column builder, mirroring the PHP `ColumnBuilder`. Instances are
 * accepted directly in `TableConfig.columns` and normalized by the component.
 */
export class ColumnBuilder<T = unknown> {
  private readonly def: ColumnDef<T>;

  private constructor(field: string, label: string, type: ColumnType) {
    this.def = {
      field,
      label,
      type,
      sortable: type !== 'badge' && type !== 'boolean' && type !== 'image',
      visible: true,
      toggleable: true,
      align: type === 'number' || type === 'currency' ? 'right' : 'left',
    };
  }

  static make<T>(field: string, label: string, type: ColumnType): ColumnBuilder<T> {
    return new ColumnBuilder<T>(field, label, type);
  }

  sortable(on = true): this {
    this.def.sortable = on;
    return this;
  }
  /** Backend sort key when it differs from the field. */
  sortAs(sortField: string): this {
    this.def.sortField = sortField;
    return this;
  }
  /** Hidden initially (still toggleable unless `notToggleable`). */
  hidden(): this {
    this.def.visible = false;
    return this;
  }
  notToggleable(): this {
    this.def.toggleable = false;
    return this;
  }
  width(width: string): this {
    this.def.width = width;
    return this;
  }
  align(align: 'left' | 'right' | 'center'): this {
    this.def.align = align;
    return this;
  }
  badgeColors(colors: Record<string, BadgeTone>): this {
    this.def.badgeColors = colors;
    return this;
  }
  format(format: string): this {
    this.def.format = format;
    return this;
  }
  value(accessor: (row: T) => unknown): this {
    this.def.value = accessor;
    return this;
  }
  formatter(fn: (value: unknown, row: T) => string): this {
    this.def.formatter = fn;
    return this;
  }

  build(): ColumnDef<T> {
    return { ...this.def };
  }
}

/** Fluent column factories, e.g. `col.text('email', 'Email').sortable()`. */
export const col = {
  text: <T>(field: string, label: string) => ColumnBuilder.make<T>(field, label, 'text'),
  email: <T>(field: string, label: string) => ColumnBuilder.make<T>(field, label, 'email'),
  badge: <T>(field: string, label: string) => ColumnBuilder.make<T>(field, label, 'badge'),
  boolean: <T>(field: string, label: string) => ColumnBuilder.make<T>(field, label, 'boolean'),
  date: <T>(field: string, label: string) => ColumnBuilder.make<T>(field, label, 'date'),
  datetime: <T>(field: string, label: string) => ColumnBuilder.make<T>(field, label, 'datetime'),
  number: <T>(field: string, label: string) => ColumnBuilder.make<T>(field, label, 'number'),
  currency: <T>(field: string, label: string) => ColumnBuilder.make<T>(field, label, 'currency'),
  /** A thumbnail cell; the field holds a server-relative `/uploads/...` URL. */
  image: <T>(field: string, label: string) => ColumnBuilder.make<T>(field, label, 'image'),
};

/** Normalize a mixed list of builders/defs into resolved `ColumnDef`s. */
export function resolveColumns<T>(columns: Array<ColumnDef<T> | ColumnBuilder<T>>): ColumnDef<T>[] {
  return columns.map((c) => (c instanceof ColumnBuilder ? c.build() : c));
}
