import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { DataTable } from '../../../../shared/datatable/data-table';
import { TableConfig, TableDataSource, col } from '../../../../shared/datatable/table-config';
import { clientSideSource } from '../../../../shared/datatable/client-side';
import { fmtDateTime, fmtMoney } from '../../shared/scm-format';
import { receiptKindTones, receiptStatusTones } from '../shared/pos-format';
import {
  PosOrderHeader,
  PosOrderKind,
  PosServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** Every receipt the tills produced — sales and refunds, voided ones included. */
@Component({
  selector: 'app-pos-receipts-page',
  imports: [FormsModule, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './receipts.page.html',
})
export class ReceiptsPage {
  private readonly proxy = inject(PosServiceProxy);
  private readonly router = inject(Router);

  /** '' = both kinds. Changing it swaps the data source, so the table refetches. */
  readonly kind = signal<'' | PosOrderKind>('');

  readonly tableConfig = computed<TableConfig<PosOrderHeader>>(() => ({
    id: 'pos-receipts',
    rowKey: (o) => o.id,
    columns: [
      col.text<PosOrderHeader>('number', 'Number').value((o) => o.number ?? '—').width('160px'),
      col
        .badge<PosOrderHeader>('kind', 'Kind')
        .value((o) => o.kind)
        .badgeColors(receiptKindTones),
      col
        .text<PosOrderHeader>('sold_at', 'Time')
        .value((o) => fmtDateTime(o.sold_at))
        .sortable()
        .width('150px'),
      col
        .number<PosOrderHeader>('total', 'Total')
        .value((o) => fmtMoney(o.total))
        .align('right'),
      col
        .text<PosOrderHeader>('captured_offline', 'Captured')
        .value((o) => (o.captured_offline ? 'offline' : 'online')),
      col
        .badge<PosOrderHeader>('status', 'Status')
        .value((o) => o.status)
        .badgeColors(receiptStatusTones),
    ],
    defaultSort: 'sold_at',
    defaultSortDir: 'desc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search receipt number…',
    exportPdf: true,
    exportTitle: 'POS Receipts',
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No receipts yet.',
  }));

  readonly dataSource = computed<TableDataSource<PosOrderHeader>>(() => {
    const kind = this.kind();
    return clientSideSource(
      () => this.proxy.list_sales(null, kind || null).pipe(map((rows) => rows ?? [])),
      (o, term) => (o.number ?? '').toLowerCase().includes(term),
    );
  });

  onAction(event: { key: string; row: PosOrderHeader }): void {
    if (event.key === 'view') void this.router.navigate(['/pos/receipts', event.row.id]);
  }
}
