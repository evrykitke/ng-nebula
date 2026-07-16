import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
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
import { filterSummary, orderStatusTones, statusLabel } from '../../shared/scm-format';
import {
  OrderHeader,
  OrderStatus,
  ProcurementServiceProxy,
  ProcurementSupplier,
} from '../../../../shared/service-proxies/service-proxies';

/** The purchase order register. */
@Component({
  selector: 'app-orders-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders.page.html',
})
export class OrdersPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly table = viewChild<DataTable<OrderHeader>>(DataTable);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.ordersCreate));

  readonly suppliers = signal<ProcurementSupplier[]>([]);

  statusFilter: '' | OrderStatus = '';
  supplierFilter = '';

  readonly statusLabel = statusLabel;

  readonly tableConfig = computed<TableConfig<OrderHeader>>(() => ({
    id: 'procurement-orders',
    rowKey: (o) => o.id,
    columns: [
      col.text<OrderHeader>('number', 'Number').value((o) => o.number ?? '(draft)').width('150px'),
      col.date<OrderHeader>('order_date', 'Date').sortable().width('120px'),
      col.text<OrderHeader>('supplier_name', 'Supplier').sortable(),
      col.text<OrderHeader>('currency', 'Ccy').width('70px'),
      col.date<OrderHeader>('expected_date', 'Expected').width('120px').hidden(),
      col
        .badge<OrderHeader>('status', 'Status')
        .value((o) => statusLabel(o.status))
        .badgeColors(
          orderStatusTones as Record<string, 'success' | 'info' | 'warning' | 'danger' | 'muted'>,
        ),
    ],
    defaultSort: 'order_date',
    defaultSortDir: 'desc',
    pageSize: 25,
    pageSizeOptions: [25, 50, 100],
    search: true,
    searchPlaceholder: 'Search number or supplier…',
    columnToggle: true,
    exportPdf: true,
    exportTitle: 'Purchase Orders',
    exportSubtitle: () =>
      filterSummary([
        ['Status', statusLabel(this.statusFilter)],
        ['Supplier', this.suppliers().find((s) => s.id === this.supplierFilter)?.name],
      ]),
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No purchase orders match.',
  }));

  readonly dataSource: TableDataSource<OrderHeader> = clientSideSource(
    () =>
      this.proxy
        .list_orders(this.statusFilter || null, this.supplierFilter || null, null, null)
        .pipe(map((rows) => rows ?? [])),
    (o, term) =>
      (o.number ?? '').toLowerCase().includes(term) ||
      o.supplier_name.toLowerCase().includes(term),
  );

  constructor() {
    this.proxy.list_suppliers().subscribe({
      next: (all) => this.suppliers.set(all ?? []),
      error: () => {},
    });
  }

  applyFilters(): void {
    this.table()?.load();
  }

  newOrder(): void {
    void this.router.navigate(['/procurement/orders/new']);
  }

  onAction(event: { key: string; row: OrderHeader }): void {
    if (event.key === 'view') void this.router.navigate(['/procurement/orders', event.row.id]);
  }
}
