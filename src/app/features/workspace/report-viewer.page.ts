import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideCircleCheck,
  lucideCircleX,
  lucideClock,
  lucideDownload,
  lucideDroplet,
  lucideFileText,
  lucideFilter,
  lucideMinus,
  lucidePlus,
  lucideRefreshCw,
  lucideSearch,
  lucideSlidersHorizontal,
  lucideTable,
  lucideZap,
} from '@ng-icons/lucide';
import { UiButton } from '../../shared/ui/button';
import { PageHeader } from '../../core/layout/page-header/page-header';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions.constants';
import { NotificationService } from '../../core/services/notification.service';
import { apiErrorInfo } from '../../shared/api/api-error';
import {
  DataTable,
  REPORT_FORMATS,
  ReportFormat,
  ReportInfo,
  ReportJob,
  ReportJobStatus,
  ReportOutput,
  ReportService,
  ReportSettings,
  ReportTables,
} from '../../shared/reporting/report.service';
import { PdfView } from '../../shared/reporting/pdf-view';
import { saveBlob } from '../../shared/reporting/download';

type ViewMode = 'document' | 'table';
interface SortState {
  table: number;
  col: number;
  dir: 'asc' | 'desc';
}

/**
 * The report viewer. The pages are drawn by [`PdfView`] — the same component
 * the document drawer uses, so a report looks the same wherever it is opened
 * and there is one renderer to fix. List reports can also be viewed as an
 * interactive datatable (sort + filter). The right sidebar carries the format
 * switcher, PDF/Excel downloads and, for admins, the workspace report settings.
 */
@Component({
  selector: 'app-report-viewer-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader, PdfView],
  providers: [
    provideIcons({
      lucideArrowDown,
      lucideArrowUp,
      lucideCircleCheck,
      lucideCircleX,
      lucideClock,
      lucideDownload,
      lucideDroplet,
      lucideFileText,
      lucideFilter,
      lucideMinus,
      lucidePlus,
      lucideRefreshCw,
      lucideSearch,
      lucideSlidersHorizontal,
      lucideTable,
      lucideZap,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-viewer.page.html',
})
export class ReportViewerPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly reports = inject(ReportService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  readonly formats = REPORT_FORMATS;
  readonly name = signal('');
  readonly info = signal<ReportInfo | null>(null);
  readonly format = signal<ReportFormat | null>(null);
  /** Whether the *table* is loading; the document view says so for itself. */
  readonly rendering = signal(false);

  readonly zoom = signal(1);

  private readonly pdf = viewChild(PdfView);

  // Document vs interactive table view.
  readonly view = signal<ViewMode>('document');
  readonly tables = signal<ReportTables | null>(null);
  readonly filter = signal('');
  readonly sort = signal<SortState | null>(null);

  // Admin report settings (right sidebar).
  readonly canManage = computed(() => this.auth.hasPermission(Permissions.tenantSettings));
  readonly savingSettings = signal(false);
  houseFormat: ReportFormat | '' = '';
  watermark = '';

  readonly hasExcel = computed(() => this.info()?.outputs.includes('excel') ?? false);
  readonly hasTable = computed(() => this.info()?.outputs.includes('table') ?? false);

  // Background generation: recent jobs for this report + queueing state.
  readonly jobs = signal<ReportJob[]>([]);
  readonly queuing = signal(false);
  private poll: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((pm) => {
      this.name.set(pm.get('name') ?? '');
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private load(): void {
    this.reports.list().subscribe({
      next: (list) => {
        const info = list.find((r) => r.name === this.name()) ?? null;
        this.info.set(info);
        if (info && this.format() === null) this.format.set(info.default_format);
        // Nothing to kick off for the document view: `app-pdf-view` draws
        // itself from its inputs, and asking again here would fetch it twice.
        if (this.view() === 'table') this.loadTables();
        this.loadJobs();
      },
      error: (err) => this.notify.error('Could not load the report', apiErrorInfo(err).message),
    });
    this.reports.getSettings().subscribe({
      next: (s) => this.applySettings(s),
      error: () => {},
    });
  }

  private applySettings(s: ReportSettings): void {
    this.houseFormat = s.default_format ?? '';
    this.watermark = s.watermark ?? '';
  }

  /**
   * Draw the current view again from scratch. For settings changes — a new
   * watermark or house format is not one of the view's inputs, so nothing would
   * notice it on its own.
   */
  refresh(): void {
    if (this.view() === 'table') this.loadTables();
    else this.pdf()?.load();
  }

  private loadTables(): void {
    const name = this.name();
    if (!name) return;
    this.rendering.set(true);
    this.reports.datatables(name, this.format()).subscribe({
      next: (tables) => {
        this.tables.set(tables);
        this.rendering.set(false);
      },
      error: (err) => {
        this.rendering.set(false);
        this.notify.error('Could not load the table', apiErrorInfo(err).message);
      },
    });
  }

  setView(view: ViewMode): void {
    if (this.view() === view) return;
    this.view.set(view);
    this.filter.set('');
    this.sort.set(null);
    if (view === 'table') this.loadTables();
  }

  selectFormat(format: ReportFormat): void {
    if (this.format() === format) return;
    this.format.set(format);
    if (this.view() === 'table') this.loadTables();
  }

  zoomIn(): void {
    this.zoom.update((z) => Math.min(2, +(z + 0.1).toFixed(2)));
  }
  zoomOut(): void {
    this.zoom.update((z) => Math.max(0.5, +(z - 0.1).toFixed(2)));
  }
  resetZoom(): void {
    this.zoom.set(1);
  }

  // --- Interactive table: sort + filter ------------------------------------

  toggleSort(tableIndex: number, col: number): void {
    const cur = this.sort();
    if (cur && cur.table === tableIndex && cur.col === col) {
      this.sort.set({ table: tableIndex, col, dir: cur.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      this.sort.set({ table: tableIndex, col, dir: 'asc' });
    }
  }

  sortDir(tableIndex: number, col: number): 'asc' | 'desc' | null {
    const s = this.sort();
    return s && s.table === tableIndex && s.col === col ? s.dir : null;
  }

  /** The rows of a table after applying the filter and current sort. */
  viewRows(table: DataTable, tableIndex: number): string[][] {
    const q = this.filter().trim().toLowerCase();
    let rows = table.rows;
    if (q) rows = rows.filter((r) => r.some((c) => c.toLowerCase().includes(q)));

    const s = this.sort();
    if (s && s.table === tableIndex) {
      const numeric = table.columns[s.col]?.numeric ?? false;
      rows = [...rows].sort((a, b) => {
        const av = a[s.col] ?? '';
        const bv = b[s.col] ?? '';
        const cmp = numeric ? num(av) - num(bv) : av.localeCompare(bv);
        return s.dir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }

  // --- Background generation ------------------------------------------------

  /** Reports this report's recent jobs; keeps polling while any is active. */
  private loadJobs(): void {
    const name = this.name();
    if (!name) return;
    this.reports.jobs().subscribe({
      next: (all) => {
        const mine = all.filter((j) => j.report === name);
        this.jobs.set(mine);
        if (mine.some((j) => j.status === 'queued' || j.status === 'running')) {
          this.startPolling();
        } else {
          this.stopPolling();
        }
      },
      error: () => this.stopPolling(),
    });
  }

  /** Queue a background render of the current report + format. */
  generate(output: Exclude<ReportOutput, 'table'>): void {
    const name = this.name();
    if (!name) return;
    this.queuing.set(true);
    this.reports.enqueueJob(name, this.format(), output).subscribe({
      next: () => {
        this.queuing.set(false);
        this.notify.success('Report queued', 'It will appear below when ready.');
        this.loadJobs();
      },
      error: (err) => {
        this.queuing.set(false);
        this.notify.error('Could not queue the report', apiErrorInfo(err).message);
      },
    });
  }

  downloadJob(job: ReportJob): void {
    this.reports.downloadJob(job.id).subscribe({
      next: (blob) => saveBlob(blob, job.file_name ?? `${job.report}.pdf`),
      error: (err) => this.notify.error('Download failed', apiErrorInfo(err).message),
    });
  }

  private startPolling(): void {
    if (this.poll) return;
    this.poll = setInterval(() => this.loadJobs(), 1500);
  }

  private stopPolling(): void {
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }

  jobIcon(status: ReportJobStatus): string {
    switch (status) {
      case 'completed':
        return 'lucideCircleCheck';
      case 'failed':
        return 'lucideCircleX';
      case 'running':
        return 'lucideRefreshCw';
      default:
        return 'lucideClock';
    }
  }

  // --- Downloads + settings ------------------------------------------------

  download(output: Exclude<ReportOutput, 'table'>): void {
    const name = this.name();
    this.reports.render(name, this.format(), output).subscribe({
      next: (blob) => saveBlob(blob, `${name}.${output === 'excel' ? 'xlsx' : 'pdf'}`),
      error: (err) => this.notify.error('Download failed', apiErrorInfo(err).message),
    });
  }

  saveSettings(): void {
    this.savingSettings.set(true);
    this.reports
      .saveSettings({
        default_format: this.houseFormat || null,
        watermark: this.watermark.trim() || null,
      })
      .subscribe({
        next: (s) => {
          this.applySettings(s);
          this.savingSettings.set(false);
          this.notify.success('Report settings saved');
          this.refresh();
        },
        error: (err) => {
          this.savingSettings.set(false);
          this.notify.error('Could not save settings', apiErrorInfo(err).message);
        },
      });
  }
}

/** Parse a display string (e.g. "30,000.00") to a number for sorting. */
function num(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

