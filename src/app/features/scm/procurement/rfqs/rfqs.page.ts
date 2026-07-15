import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { map } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { DataTable } from '../../../../shared/datatable/data-table';
import { TableConfig, TableDataSource, col } from '../../../../shared/datatable/table-config';
import { clientSideSource } from '../../../../shared/datatable/client-side';
import { rfqStatusTones, statusLabel } from '../../shared/scm-format';
import {
  ProcurementServiceProxy,
  RfqHeader,
  RfqStatus,
} from '../../../../shared/service-proxies/service-proxies';

/** The request-for-quotation register. */
@Component({
  selector: 'app-rfqs-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rfqs.page.html',
})
export class RfqsPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly table = viewChild<DataTable<RfqHeader>>(DataTable);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.rfqsCreate));

  statusFilter: '' | RfqStatus = '';

  readonly statusLabel = statusLabel;

  readonly tableConfig = computed<TableConfig<RfqHeader>>(() => ({
    id: 'procurement-rfqs',
    rowKey: (r) => r.id,
    columns: [
      col.text<RfqHeader>('number', 'Number').value((r) => r.number ?? '(draft)').width('150px'),
      col.text<RfqHeader>('title', 'Title').sortable(),
      col.date<RfqHeader>('due_date', 'Due').width('130px'),
      col
        .badge<RfqHeader>('status', 'Status')
        .value((r) => statusLabel(r.status))
        .badgeColors(rfqStatusTones as Record<string, 'success' | 'info' | 'warning' | 'muted'>),
    ],
    defaultSort: 'number',
    defaultSortDir: 'desc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search number or title…',
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No RFQs match.',
  }));

  readonly dataSource: TableDataSource<RfqHeader> = clientSideSource(
    () => this.proxy.list_rfqs(this.statusFilter || null).pipe(map((rows) => rows ?? [])),
    (r, term) =>
      (r.number ?? '').toLowerCase().includes(term) || r.title.toLowerCase().includes(term),
  );

  applyFilters(): void {
    this.table()?.load();
  }

  newRfq(): void {
    void this.router.navigate(['/procurement/rfqs/new']);
  }

  onAction(event: { key: string; row: RfqHeader }): void {
    if (event.key === 'view') void this.router.navigate(['/procurement/rfqs', event.row.id]);
  }
}
