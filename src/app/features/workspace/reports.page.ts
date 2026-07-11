import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight, lucideFileChartColumn, lucideFileText } from '@ng-icons/lucide';
import { PageHeader } from '../../core/layout/page-header/page-header';
import { NotificationService } from '../../core/services/notification.service';
import { apiErrorInfo } from '../../shared/api/api-error';
import { ReportInfo, ReportService } from './report.service';

/**
 * Workspace → Reports: the catalogue of reports the reporting engine
 * exposes. Each card opens the report viewer.
 */
@Component({
  selector: 'app-reports-page',
  imports: [RouterLink, NgIcon, PageHeader],
  providers: [provideIcons({ lucideChevronRight, lucideFileChartColumn, lucideFileText })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.page.html',
})
export class ReportsPage {
  private readonly reports = inject(ReportService);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(true);
  readonly items = signal<ReportInfo[]>([]);

  constructor() {
    this.reports.list().subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load reports', apiErrorInfo(err).message);
      },
    });
  }
}
