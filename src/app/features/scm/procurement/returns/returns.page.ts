import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { DataTable } from '../../../../shared/datatable/data-table';
import { TableConfig, TableDataSource, col } from '../../../../shared/datatable/table-config';
import { clientSideSource } from '../../../../shared/datatable/client-side';
import { returnStatusTones, statusLabel } from '../../shared/scm-format';
import {
  ProcurementServiceProxy,
  ReturnHeader,
  ReturnStatus,
} from '../../../../shared/service-proxies/service-proxies';

/** The purchase return register. Returns are raised against a purchase order. */
@Component({
  selector: 'app-returns-page',
  imports: [FormsModule, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './returns.page.html',
})
export class ReturnsPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly router = inject(Router);

  private readonly table = viewChild<DataTable<ReturnHeader>>(DataTable);

  statusFilter: '' | ReturnStatus = '';

  readonly statusLabel = statusLabel;

  readonly tableConfig = computed<TableConfig<ReturnHeader>>(() => ({
    id: 'procurement-returns',
    rowKey: (r) => r.id,
    columns: [
      col.text<ReturnHeader>('number', 'Number').value((r) => r.number ?? '(draft)').width('150px'),
      col.date<ReturnHeader>('return_date', 'Date').sortable().width('120px'),
      col.text<ReturnHeader>('order_number', 'Order').value((r) => r.order_number ?? '—'),
      col.text<ReturnHeader>('reason', 'Reason').value((r) => r.reason ?? '—'),
      col
        .badge<ReturnHeader>('status', 'Status')
        .value((r) => statusLabel(r.status))
        .badgeColors(returnStatusTones as Record<string, 'success' | 'warning' | 'muted'>),
    ],
    defaultSort: 'return_date',
    defaultSortDir: 'desc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search number or order…',
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No returns match.',
  }));

  readonly dataSource: TableDataSource<ReturnHeader> = clientSideSource(
    () =>
      this.proxy
        .list_returns(null, this.statusFilter || null, null, null)
        .pipe(map((rows) => rows ?? [])),
    (r, term) =>
      (r.number ?? '').toLowerCase().includes(term) ||
      (r.order_number ?? '').toLowerCase().includes(term),
  );

  applyFilters(): void {
    this.table()?.load();
  }

  onAction(event: { key: string; row: ReturnHeader }): void {
    if (event.key === 'view') void this.router.navigate(['/procurement/returns', event.row.id]);
  }
}
