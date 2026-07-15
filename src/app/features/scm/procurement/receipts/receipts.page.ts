import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { DataTable } from '../../../../shared/datatable/data-table';
import { TableConfig, TableDataSource, col } from '../../../../shared/datatable/table-config';
import { clientSideSource } from '../../../../shared/datatable/client-side';
import { receiptStatusTones, statusLabel } from '../../shared/scm-format';
import {
  ProcurementServiceProxy,
  ReceiptHeader,
  ReceiptStatus,
} from '../../../../shared/service-proxies/service-proxies';

/** The goods receipt register. Receipts are always raised from a purchase order. */
@Component({
  selector: 'app-receipts-page',
  imports: [FormsModule, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './receipts.page.html',
})
export class ReceiptsPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly router = inject(Router);

  private readonly table = viewChild<DataTable<ReceiptHeader>>(DataTable);

  statusFilter: '' | ReceiptStatus = '';

  readonly statusLabel = statusLabel;

  readonly tableConfig = computed<TableConfig<ReceiptHeader>>(() => ({
    id: 'procurement-receipts',
    rowKey: (r) => r.id,
    columns: [
      col.text<ReceiptHeader>('number', 'Number').value((r) => r.number ?? '(draft)').width('150px'),
      col.date<ReceiptHeader>('receipt_date', 'Date').sortable().width('120px'),
      col.text<ReceiptHeader>('order_number', 'Order').value((r) => r.order_number ?? '—'),
      col.text<ReceiptHeader>('reference', 'Delivery note').value((r) => r.reference ?? '—'),
      col
        .badge<ReceiptHeader>('status', 'Status')
        .value((r) => statusLabel(r.status))
        .badgeColors(receiptStatusTones as Record<string, 'success' | 'warning' | 'muted'>),
    ],
    defaultSort: 'receipt_date',
    defaultSortDir: 'desc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search number, order or delivery note…',
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No goods receipts match.',
  }));

  readonly dataSource: TableDataSource<ReceiptHeader> = clientSideSource(
    () =>
      this.proxy
        .list_receipts(null, this.statusFilter || null, null, null)
        .pipe(map((rows) => rows ?? [])),
    (r, term) =>
      (r.number ?? '').toLowerCase().includes(term) ||
      (r.order_number ?? '').toLowerCase().includes(term) ||
      (r.reference ?? '').toLowerCase().includes(term),
  );

  applyFilters(): void {
    this.table()?.load();
  }

  onAction(event: { key: string; row: ReceiptHeader }): void {
    if (event.key === 'view') void this.router.navigate(['/procurement/receipts', event.row.id]);
  }
}
