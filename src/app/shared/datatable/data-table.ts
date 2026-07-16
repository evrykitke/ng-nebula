import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
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
  lucideFileText,
  lucideUpload,
} from '@ng-icons/lucide';
import { DateTime } from 'luxon';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { apiErrorInfo } from '../api/api-error';
import { badgeVariants } from '../ui/badge';
import { saveBlob, slugify } from '../reporting/download';
import { ExportColumn, ListExport, ReportService } from '../reporting/report.service';
import { ReportFilterModal } from './report-filter-modal';
import { Criterion, FilterField, applyFilters, filterFields, summarize } from './report-filter';
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
  imports: [
    FormsModule,
    NgTemplateOutlet,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    NgIcon,
    ReportFilterModal,
  ],
  providers: [
    provideIcons({
      lucideEllipsisVertical,
      lucideColumns3,
      lucideDownload,
      lucideUpload,
      lucideFileDown,
      lucideFileText,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.html',
})
export class DataTable<T = unknown> {
  private readonly reports = inject(ReportService);
  private readonly notify = inject(NotificationService);

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
    return !!(cfg.columnToggle || cfg.exportPdf || cfg.exportCsv || cfg.importCsv);
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
  /** True while an export is being fetched and rendered. */
  readonly exporting = signal(false);
  /** The criteria form, open between fetching an export's rows and rendering them. */
  readonly showFilters = signal(false);
  readonly filterFields = signal<FilterField<T>[]>([]);

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
  /** Rows one export may carry — the server rejects more than this. */
  private static readonly EXPORT_MAX = 20_000;
  /** The fetched rows awaiting the criteria form's verdict. */
  private pending: { rows: T[]; total: number; search: string; columns: ColumnDef<T>[] } | null =
    null;
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

  // ---- PDF export ----
  /**
   * The columns an export carries: those left visible by the column toggle,
   * minus images (a thumbnail's cell text is a URL, which is noise on paper).
   */
  private exportColumns(): ColumnDef<T>[] {
    return this.visibleColumns().filter((c) => c.type !== 'image');
  }

  /**
   * Step one of an export: fetch every row the current search and filters
   * select — not just the page on screen — then ask which of them belong on
   * the paper.
   *
   * The rows are fetched before the form opens so the filters can offer the
   * values the rows actually hold, rather than every value the column could
   * theoretically take. The rows are re-fetched rather than taken from
   * `rows()`, which holds one page; the query is otherwise identical, so the
   * document says what the screen says.
   */
  exportPdf(): void {
    if (this.exporting()) return;
    const columns = this.exportColumns();
    if (!columns.length) {
      this.notify.warn('Nothing to export', 'Every column is hidden.');
      return;
    }

    this.exporting.set(true);
    const search = this.effectiveSearch(this.search());
    const query: TableQuery = {
      page: 0,
      size: DataTable.EXPORT_MAX,
      search,
      sort: this.sort(),
      sortDir: this.sortDir(),
    };

    this.dataSource()(query).subscribe({
      next: (res) => {
        this.exporting.set(false);
        if (!res.rows.length) {
          this.notify.warn('Nothing to export', 'No rows match the current filters.');
          return;
        }
        this.pending = { rows: res.rows, total: res.total, search, columns };
        this.filterFields.set(filterFields(columns, res.rows, (row, c) => this.cellText(row, c)));
        this.showFilters.set(true);
      },
      error: (err) => {
        this.exporting.set(false);
        const { message } = apiErrorInfo(err);
        this.notify.error('Export failed', message);
      },
    });
  }

  /**
   * Step two: narrow the fetched rows to what was asked for and render them.
   * The criteria only ever reach this copy of the rows — the screen keeps
   * showing what it showed.
   */
  renderExport(values: Record<string, Criterion>): void {
    const pending = this.pending;
    if (!pending || this.exporting()) return;
    this.showFilters.set(false);
    this.pending = null;

    const { columns, total, search } = pending;
    const rows = applyFilters(pending.rows, this.filterFields(), values, (row, c) =>
      this.cellText(row, c),
    );
    if (!rows.length) {
      this.notify.warn('Nothing to export', 'No rows match those filters.');
      return;
    }

    const cfg = this.config();
    const title = cfg.exportTitle ?? prettify(cfg.id);
    const list: ListExport = {
      title,
      subtitle: this.exportSubtitle(rows.length, total, search, summarize(this.filterFields(), values)),
      orientation: cfg.exportOrientation ?? (columns.length > 6 ? 'landscape' : 'portrait'),
      columns: columns.map((c) => ({ label: c.label, align: exportAlign(c.align) })),
      rows: rows.map((row) => columns.map((c) => this.cellText(row, c))),
    };

    this.exporting.set(true);
    this.reports.exportList(list).subscribe({
      next: (blob) => {
        saveBlob(blob, `${slugify(title)}-${DateTime.now().toFormat('yyyy-LL-dd')}.pdf`);
        this.exporting.set(false);
      },
      error: (err) => {
        this.exporting.set(false);
        const { message } = apiErrorInfo(err);
        this.notify.error('Export failed', message);
      },
    });
  }

  cancelExport(): void {
    this.showFilters.set(false);
    this.pending = null;
  }

  /**
   * The line under the title: what the page filtered to, what the export was
   * narrowed to, then how many rows that came to — so a printed list says what
   * it is, months later, without the screen it came from.
   */
  private exportSubtitle(rows: number, total: number, search: string, criteria: string[]): string {
    const bits: string[] = [];
    const filters = this.config().exportSubtitle?.();
    if (filters?.trim()) bits.push(filters.trim());
    if (search) bits.push(`Search: “${search}”`);
    bits.push(...criteria);
    // `rows` is what the document holds; it falls short of `total` when the
    // export was narrowed, or when the list is longer than one export — either
    // way the reader deserves to know it is not the whole story.
    bits.push(rows < total ? `${rows} of ${total} records` : `${rows} records`);
    return bits.join(' · ');
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

/** A column's alignment in the terms the reporting engine uses. */
function exportAlign(align: ColumnDef['align']): ExportColumn['align'] {
  switch (align) {
    case 'right':
      return 'end';
    case 'center':
      return 'center';
    default:
      return 'start';
  }
}

/** A table id as a document title, e.g. `procurement-orders` → `Procurement orders`. */
function prettify(id: string): string {
  const words = id.replace(/[-_]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Export';
}

/**
 * The tones a cell badge can take, drawn by the shared badge.
 *
 * These were Tailwind's own greens and reds, pinned shade by shade with a dark
 * variant each. That made the busiest surface in the app the one thing that
 * ignored the active theme: it kept a modern pill — fully round, pastel — in a
 * theme whose radius is 2px, and left `--success`/`--destructive`/`--warning`
 * defined but unused. A badge now looks the same in a list as on a detail page,
 * and follows whatever theme is on.
 */
const TONE_CLASSES: Record<BadgeTone, string> = {
  success: badgeVariants({ variant: 'success' }),
  danger: badgeVariants({ variant: 'danger' }),
  warning: badgeVariants({ variant: 'warning' }),
  info: badgeVariants({ variant: 'info' }),
  muted: badgeVariants({ variant: 'default' }),
};
