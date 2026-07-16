import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
import { fmtDate, salesOrderStatusTones, statusLabel } from '../../shared/scm-format';
import {
  SalesOrderHeader,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** Sales orders — customer commitments driving delivery and billing. */
@Component({
  selector: 'app-sales-orders-page',
  imports: [NgIcon, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-orders.page.html',
})
export class SalesOrdersPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.salesOrdersCreate));

  readonly tableConfig = computed<TableConfig<SalesOrderHeader>>(() => ({
    id: 'sales-orders',
    rowKey: (o) => o.id,
    columns: [
      col.text<SalesOrderHeader>('number', 'Number').value((o) => o.number ?? '(draft)').width('140px'),
      col.text<SalesOrderHeader>('customer_name', 'Customer').sortable(),
      col.text<SalesOrderHeader>('order_date', 'Date').value((o) => fmtDate(o.order_date)).width('120px'),
      col
        .text<SalesOrderHeader>('expected_date', 'Expected')
        .value((o) => fmtDate(o.expected_date))
        .width('120px'),
      col.text<SalesOrderHeader>('currency', 'Ccy').width('70px'),
      col
        .badge<SalesOrderHeader>('status', 'Status')
        .value((o) => statusLabel(o.status))
        .badgeColors({
          draft: 'muted',
          confirmed: 'info',
          partially_delivered: 'warning',
          delivered: 'success',
          closed: 'muted',
          cancelled: 'danger',
        }),
    ],
    defaultSort: 'order_date',
    defaultSortDir: 'desc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search number or customer…',
    columnToggle: true,
    exportPdf: true,
    exportTitle: 'Sales Orders',
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No sales orders yet.',
  }));

  readonly tones = salesOrderStatusTones;

  readonly dataSource: TableDataSource<SalesOrderHeader> = clientSideSource(
    () => this.proxy.list_orders2(null, null, null, null).pipe(map((rows) => rows ?? [])),
    (o, term) =>
      (o.number ?? '').toLowerCase().includes(term) ||
      o.customer_name.toLowerCase().includes(term),
  );

  newOrder(): void {
    void this.router.navigate(['/sales/orders/new']);
  }

  onAction(event: { key: string; row: SalesOrderHeader }): void {
    if (event.key === 'view') void this.router.navigate(['/sales/orders', event.row.id]);
  }
}
