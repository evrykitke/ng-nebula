import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideFileChartColumn,
  lucideFileText,
  lucideMaximize2,
  lucideSearch,
  lucideTable,
  lucideX,
} from '@ng-icons/lucide';
import { PageHeader } from '../../core/layout/page-header/page-header';
import { NotificationService } from '../../core/services/notification.service';
import { apiErrorInfo } from '../../shared/api/api-error';
import { UiButton } from '../../shared/ui/button';
import { ReportDrawer } from '../../shared/reporting/report-drawer';
import { ReportInfo, ReportService } from '../../shared/reporting/report.service';

/** A report plus what the catalogue needs to say about it. */
interface Listed extends ReportInfo {
  /** Lowercased haystack, so searching does not re-lowercase on every keystroke. */
  haystack: string;
}

/** One group's worth of reports. */
interface Section {
  name: string;
  reports: Listed[];
}

/**
 * Workspace → Reports: the catalogue of everything the engine can draw.
 *
 * Two things it has to get right. First, half the catalogue cannot be run from
 * here: a purchase order draws one record and answers `?id=`, so a link to it
 * from a list of *reports* only produces an error. Those are shown apart, named
 * for what they are, and not offered as something to click.
 *
 * Second, thirty-odd entries is more than anyone reads. Search and the group
 * filter narrow it; the reports themselves open in a drawer over this page, so
 * checking three of them in a row does not mean three round trips through a
 * route.
 */
@Component({
  selector: 'app-reports-page',
  imports: [FormsModule, RouterLink, NgIcon, PageHeader, UiButton, ReportDrawer],
  providers: [
    provideIcons({
      lucideFileChartColumn,
      lucideFileText,
      lucideSearch,
      lucideTable,
      lucideMaximize2,
      lucideX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.page.html',
})
export class ReportsPage {
  private readonly reports = inject(ReportService);
  private readonly notify = inject(NotificationService);
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');

  readonly loading = signal(true);
  readonly all = signal<Listed[]>([]);
  readonly search = signal('');
  /** `null` is "every group". */
  readonly group = signal<string | null>(null);

  /** The report open in the drawer, if any. */
  readonly viewing = signal<Listed | null>(null);

  readonly total = computed(() => this.all().length);

  /** Every group, with how many reports it holds — the filter's own labels. */
  readonly groups = computed(() => {
    const counts = new Map<string, number>();
    for (const r of this.all()) counts.set(r.group, (counts.get(r.group) ?? 0) + 1);
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  /** What survives the search box and the group filter. */
  private readonly matching = computed(() => {
    const needle = this.search().trim().toLowerCase();
    const group = this.group();
    return this.all().filter(
      (r) => (!group || r.group === group) && (!needle || r.haystack.includes(needle)),
    );
  });

  /** The runnable ones — a trial balance, an aging — grouped. */
  readonly sections = computed(() => this.sectioned(this.matching().filter((r) => !r.requires_record)));
  /** The per-record ones, which are reached from their record, not from here. */
  readonly documents = computed(() => this.matching().filter((r) => r.requires_record));

  readonly showing = computed(() => this.matching().length);
  readonly filtered = computed(() => !!this.search().trim() || !!this.group());

  constructor() {
    this.reports.list().subscribe({
      next: (list) => {
        this.all.set(
          list
            .map((r) => ({ ...r, haystack: `${r.title} ${r.name} ${r.group}`.toLowerCase() }))
            .sort((a, b) => a.title.localeCompare(b.title)),
        );
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load reports', apiErrorInfo(err).message);
      },
    });
  }

  /** `/` puts the cursor in the search box, as it does everywhere else. */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
    if (event.key === '/' && !typing) {
      event.preventDefault();
      this.searchBox()?.nativeElement.focus();
    }
  }

  clear(): void {
    this.search.set('');
    this.group.set(null);
  }

  private sectioned(list: Listed[]): Section[] {
    const byGroup = new Map<string, Listed[]>();
    for (const report of list) {
      const bucket = byGroup.get(report.group) ?? [];
      bucket.push(report);
      byGroup.set(report.group, bucket);
    }
    return [...byGroup.entries()]
      .map(([name, reports]) => ({ name, reports }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
