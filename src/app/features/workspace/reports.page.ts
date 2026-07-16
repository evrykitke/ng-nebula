import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideFileChartColumn, lucideFileText } from '@ng-icons/lucide';
import { PageHeader } from '../../core/layout/page-header/page-header';
import { NotificationService } from '../../core/services/notification.service';
import { apiErrorInfo } from '../../shared/api/api-error';
import { ReportGroup, ReportInfo, ReportService } from '../../shared/reporting/report.service';

/**
 * Workspace → Reports: the report catalogue, organised into one collapsible
 * accordion per group (module). Each report opens the viewer.
 */
@Component({
  selector: 'app-reports-page',
  imports: [RouterLink, NgIcon, PageHeader],
  providers: [provideIcons({ lucideChevronDown, lucideFileChartColumn, lucideFileText })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.page.html',
})
export class ReportsPage {
  private readonly reports = inject(ReportService);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(true);
  readonly groups = signal<ReportGroup[]>([]);
  /** Collapsed group names; groups are open by default. */
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());
  readonly total = computed(() => this.groups().reduce((n, g) => n + g.reports.length, 0));

  constructor() {
    this.reports.list().subscribe({
      next: (list) => {
        this.groups.set(this.group(list));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load reports', apiErrorInfo(err).message);
      },
    });
  }

  isOpen(group: string): boolean {
    return !this.collapsed().has(group);
  }

  toggle(group: string): void {
    const next = new Set(this.collapsed());
    if (next.has(group)) next.delete(group);
    else next.add(group);
    this.collapsed.set(next);
  }

  /** Bucket reports by group, groups and reports alphabetically. */
  private group(list: ReportInfo[]): ReportGroup[] {
    const byGroup = new Map<string, ReportInfo[]>();
    for (const report of list) {
      const bucket = byGroup.get(report.group) ?? [];
      bucket.push(report);
      byGroup.set(report.group, bucket);
    }
    return [...byGroup.entries()]
      .map(([name, reports]) => ({
        name,
        reports: reports.sort((a, b) => a.title.localeCompare(b.title)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
