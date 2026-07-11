import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideDownload,
  lucideDroplet,
  lucideFileText,
  lucideFilter,
  lucideMinus,
  lucidePlus,
  lucideSearch,
  lucideSlidersHorizontal,
  lucideTable,
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
  ReportOutput,
  ReportService,
  ReportSettings,
  ReportTables,
} from './report.service';

type ViewMode = 'document' | 'table';
interface SortState {
  table: number;
  col: number;
  dir: 'asc' | 'desc';
}

/**
 * The report viewer. The preview matches the app theme: instead of the
 * browser's native PDF viewer, the report's pages are rendered as SVG
 * (themed chrome around white "paper") with a custom zoom toolbar. List
 * reports can also be viewed as an interactive datatable (sort + filter).
 * The right sidebar carries the format switcher, PDF/Excel downloads and,
 * for admins, the workspace report settings.
 */
@Component({
  selector: 'app-report-viewer-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader],
  providers: [
    provideIcons({
      lucideArrowDown,
      lucideArrowUp,
      lucideDownload,
      lucideDroplet,
      lucideFileText,
      lucideFilter,
      lucideMinus,
      lucidePlus,
      lucideSearch,
      lucideSlidersHorizontal,
      lucideTable,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-viewer.page.html',
  // The SVG comes in via [innerHTML], so it lives outside emulated view
  // encapsulation — ::ng-deep lets us size it to fit its page card.
  styles: [
    `
      :host ::ng-deep .report-page svg {
        width: 100%;
        height: auto;
        display: block;
      }
    `,
  ],
})
export class ReportViewerPage {
  private readonly route = inject(ActivatedRoute);
  private readonly reports = inject(ReportService);
  private readonly auth = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly notify = inject(NotificationService);

  readonly formats = REPORT_FORMATS;
  readonly name = signal('');
  readonly info = signal<ReportInfo | null>(null);
  readonly format = signal<ReportFormat | null>(null);
  readonly rendering = signal(false);

  // Preview (themed SVG pages) + zoom.
  readonly pages = signal<SafeHtml[]>([]);
  readonly zoom = signal(1);
  /** Portrait A4 at ~96dpi; scaled by the zoom factor. */
  readonly pageWidth = computed(() => Math.round(794 * this.zoom()));

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

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((pm) => {
      this.name.set(pm.get('name') ?? '');
      this.load();
    });
  }

  private load(): void {
    this.reports.list().subscribe({
      next: (list) => {
        const info = list.find((r) => r.name === this.name()) ?? null;
        this.info.set(info);
        if (info && this.format() === null) this.format.set(info.default_format);
        this.refresh();
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

  /** (Re)load whatever the current view needs. */
  refresh(): void {
    if (this.view() === 'table') this.loadTables();
    else this.renderPreview();
  }

  private renderPreview(): void {
    const name = this.name();
    if (!name) return;
    this.rendering.set(true);
    this.reports.preview(name, this.format()).subscribe({
      next: (preview) => {
        this.pages.set(preview.pages.map((svg) => this.sanitizer.bypassSecurityTrustHtml(svg)));
        this.rendering.set(false);
      },
      error: (err) => {
        this.rendering.set(false);
        this.notify.error('Could not render the report', apiErrorInfo(err).message);
      },
    });
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
    this.refresh();
  }

  selectFormat(format: ReportFormat): void {
    if (this.format() === format) return;
    this.format.set(format);
    this.refresh();
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

/** Trigger a browser download of a rendered blob. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
