import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideColumns3,
  lucideDownload,
  lucideEllipsisVertical,
  lucideFileDown,
  lucideUpload,
} from '@ng-icons/lucide';
import { DateTime } from 'luxon';
import { environment } from '../../../environments/environment';
import {
  BadgeTone,
  ColumnDef,
  RowAction,
  TableConfig,
  TableDataSource,
  TableQuery,
  resolveColumns,
} from './table-config';

/**
 * A configurable, self-loading data table: search, sorting, pagination,
 * multi-select, per-row actions, and a column-visibility toggle. Driven by a
 * `TableConfig` (presentation) and a `TableDataSource` (the parent's proxy
 * call). Reusable across every entity list — the framework's table primitive.
 *
 * Custom toolbar filters can be projected with `[toolbar]`; an optional
 * `[rowDetail]` template renders an expandable detail row per record.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, CdkMenu, CdkMenuItem, CdkMenuTrigger, NgIcon],
  providers: [
    provideIcons({
      lucideEllipsisVertical,
      lucideColumns3,
      lucideDownload,
      lucideUpload,
      lucideFileDown,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.html',
})
export class DataTable<T = unknown> {
  /** The declarative configuration for this table. */
  readonly config = input.required<TableConfig<T>>();
  /** Turns a query into a page of rows (the parent owns the proxy call). */
  readonly dataSource = input.required<TableDataSource<T>>();
  /** Optional expandable detail row; receives the row as `$implicit`. */
  readonly rowDetail = input<TemplateRef<unknown> | null>(null);

  /** Emitted when a per-row action button is clicked. */
  readonly action = output<{ key: string; row: T }>();
  /** Emitted when a row body is clicked (not on a control). */
  readonly rowClick = output<T>();
  /** Emitted whenever the selected rows change (multi-select). */
  readonly selectionChange = output<T[]>();
  /** Emitted when "Export CSV" is chosen from the tools menu. */
  readonly exportCsv = output<void>();
  /** Emitted when "Import CSV" is chosen from the tools menu. */
  readonly importCsv = output<void>();
  /** Emitted when "Download template" is chosen from the tools menu. */
  readonly downloadTemplate = output<void>();

  // Resolved columns (builders → defs).
  readonly columns = computed<ColumnDef<T>[]>(() => resolveColumns(this.config().columns));
  private readonly hidden = signal<Set<string>>(new Set());
  readonly visibleColumns = computed(() =>
    this.columns().filter((c) => !this.hidden().has(c.field)),
  );
  readonly toggleableColumns = computed(() => this.columns().filter((c) => c.toggleable));
  /** Whether the kebab tools menu has any items to show. */
  readonly hasTools = computed(() => {
    const cfg = this.config();
    return !!(cfg.columnToggle || cfg.exportCsv || cfg.importCsv);
  });

  // Data + query state.
  readonly rows = signal<T[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly page = signal(0);
  readonly size = signal(25);
  readonly search = signal('');
  readonly sort = signal<string | null>(null);
  readonly sortDir = signal<'asc' | 'desc'>('asc');

  // Selection + UI.
  readonly selected = signal<Set<string>>(new Set());
  readonly showColumns = signal(false);
  readonly expanded = signal<Set<string>>(new Set());

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  readonly allSelected = computed(() => {
    const rows = this.rows();
    return rows.length > 0 && rows.every((r) => this.selected().has(this.config().rowKey(r)));
  });
  readonly colspan = computed(
    () =>
      this.visibleColumns().length +
      (this.config().multiSelect ? 1 : 0) +
      (this.config().actions?.length ? 1 : 0) +
      (this.rowDetail() ? 1 : 0),
  );

  /** Placeholder rows for the skeleton shown on the first (empty) load. */
  readonly skeletonRows = Array.from({ length: 8 });
  /** True while refreshing over existing rows (dim in place, no height jump). */
  readonly refreshing = computed(() => this.loading() && this.rows().length > 0);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  /** Minimum characters before a search hits the server. */
  private static readonly MIN_SEARCH = 3;
  /** The last effective search term actually queried (to skip no-op requests). */
  private lastSearch = '';

  constructor() {
    // Initialize defaults from the config the first time it resolves, then load.
    effect(() => {
      const cfg = this.config();
      if (this.initialized) return;
      this.initialized = true;
      this.size.set(cfg.pageSize ?? 25);
      this.sort.set(cfg.defaultSort ?? null);
      this.sortDir.set(cfg.defaultSortDir ?? 'asc');
      this.hidden.set(new Set(this.columns().filter((c) => !c.visible).map((c) => c.field)));
      this.load();
    });
  }

  /**
   * (Re)fetch — call after external mutations (create/delete) or when an
   * externally-owned filter (projected into `[toolbar]`) changes. Pass
   * `resetPage` to jump back to the first page (e.g. on a filter change).
   */
  reload(resetPage = false): void {
    if (resetPage) this.page.set(0);
    this.load();
  }

  /** The current query state — used by the parent for export links etc. */
  query(): TableQuery {
    return {
      page: this.page(),
      size: this.size(),
      search: this.effectiveSearch(this.search()),
      sort: this.sort(),
      sortDir: this.sortDir(),
    };
  }

  /** The term actually sent to the server: only filter on ≥3 chars, else none. */
  private effectiveSearch(value: string): string {
    const term = value.trim();
    return term.length >= DataTable.MIN_SEARCH ? term : '';
  }

  /** (Re)fetch the current page — call after external mutations (create/delete). */
  load(): void {
    this.loading.set(true);
    const search = this.effectiveSearch(this.search());
    this.lastSearch = search;
    const query: TableQuery = {
      page: this.page(),
      size: this.size(),
      search,
      sort: this.sort(),
      sortDir: this.sortDir(),
    };
    this.dataSource()(query).subscribe({
      next: (res) => {
        this.rows.set(res.rows);
        this.total.set(res.total);
        this.loading.set(false);
        // Drop selections that are no longer on the page.
        this.pruneSelection();
      },
      error: () => this.loading.set(false),
    });
  }

  // ---- Search ----
  onSearch(value: string): void {
    this.search.set(value);
    // Only query when the *effective* term changes: typing 1–2 chars never hits
    // the server, and clearing the box (back to <3) resets to the full list.
    const eff = this.effectiveSearch(value);
    if (eff === this.lastSearch) return;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(0);
      this.load();
    }, 300);
  }

  // ---- Sorting ----
  sortKey(c: ColumnDef<T>): string {
    return c.sortField ?? c.field;
  }
  isSorted(c: ColumnDef<T>): boolean {
    return this.sort() === this.sortKey(c);
  }
  toggleSort(c: ColumnDef<T>): void {
    if (!c.sortable) return;
    const key = this.sortKey(c);
    if (this.sort() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sort.set(key);
      this.sortDir.set('asc');
    }
    this.page.set(0);
    this.load();
  }

  // ---- Pagination ----
  prev(): void {
    if (this.page() > 0) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }
  next(): void {
    if (this.page() + 1 < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }
  changeSize(size: number): void {
    this.size.set(Number(size));
    this.page.set(0);
    this.load();
  }

  // ---- Selection ----
  private key(row: T): string {
    return this.config().rowKey(row);
  }
  isSelected(row: T): boolean {
    return this.selected().has(this.key(row));
  }
  toggleRow(row: T): void {
    const next = new Set(this.selected());
    const k = this.key(row);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    this.selected.set(next);
    this.emitSelection();
  }
  toggleAll(): void {
    const next = new Set(this.selected());
    if (this.allSelected()) {
      this.rows().forEach((r) => next.delete(this.key(r)));
    } else {
      this.rows().forEach((r) => next.add(this.key(r)));
    }
    this.selected.set(next);
    this.emitSelection();
  }
  clearSelection(): void {
    this.selected.set(new Set());
    this.emitSelection();
  }
  private pruneSelection(): void {
    const present = new Set(this.rows().map((r) => this.key(r)));
    const next = new Set([...this.selected()].filter((k) => present.has(k)));
    if (next.size !== this.selected().size) {
      this.selected.set(next);
      this.emitSelection();
    }
  }
  private emitSelection(): void {
    const set = this.selected();
    this.selectionChange.emit(this.rows().filter((r) => set.has(this.key(r))));
  }

  // ---- Column toggle ----
  isHidden(field: string): boolean {
    return this.hidden().has(field);
  }
  toggleColumn(field: string): void {
    const next = new Set(this.hidden());
    if (next.has(field)) next.delete(field);
    else next.add(field);
    this.hidden.set(next);
  }

  // ---- Expandable rows ----
  isExpanded(row: T): boolean {
    return this.expanded().has(this.key(row));
  }
  toggleExpand(row: T): void {
    const next = new Set(this.expanded());
    const k = this.key(row);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    this.expanded.set(next);
  }

  // ---- Actions ----
  visibleActions(row: T): RowAction<T>[] {
    return (this.config().actions ?? []).filter((a) => !a.visible || a.visible(row));
  }
  onAction(key: string, row: T, event: Event): void {
    event.stopPropagation();
    this.action.emit({ key, row });
  }
  onRowClick(row: T): void {
    this.rowClick.emit(row);
  }

  // ---- Cell rendering ----
  private raw(row: T, c: ColumnDef<T>): unknown {
    return c.value ? c.value(row) : (row as Record<string, unknown>)[c.field];
  }
  cellText(row: T, c: ColumnDef<T>): string {
    const value = this.raw(row, c);
    if (c.formatter) return c.formatter(value, row);
    if (value === null || value === undefined || value === '') return '—';
    switch (c.type) {
      case 'date':
        return this.formatDate(value, c.format ?? 'yyyy-LL-dd');
      case 'datetime':
        return this.formatDate(value, c.format ?? 'yyyy-LL-dd HH:mm');
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value);
      case 'currency':
        return typeof value === 'number'
          ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : String(value);
      default:
        return String(value);
    }
  }
  /** Absolute src for an `image` cell, or `null` when the row has none. */
  imageSrc(row: T, c: ColumnDef<T>): string | null {
    const value = this.raw(row, c);
    if (typeof value !== 'string' || !value) return null;
    return value.startsWith('/') ? environment.apiBaseUrl + value : value;
  }
  /** Badge tone → theme classes. Falls back to a neutral muted tone. */
  toneClass(row: T, c: ColumnDef<T>): string {
    const value = this.raw(row, c);
    const key = c.type === 'boolean' ? String(!!value) : String(value);
    const tone: BadgeTone = c.badgeColors?.[key] ?? 'muted';
    return TONE_CLASSES[tone];
  }

  private formatDate(value: unknown, fmt: string): string {
    // NSwag maps timestamps to luxon DateTime; also accept ISO strings.
    const dt =
      value instanceof DateTime
        ? value
        : typeof value === 'string'
          ? DateTime.fromISO(value)
          : null;
    return dt?.isValid ? dt.toFormat(fmt) : String(value);
  }
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  muted: 'bg-muted text-muted-foreground',
};
