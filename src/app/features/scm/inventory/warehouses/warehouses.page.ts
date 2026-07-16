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
import {
  InventoryServiceProxy,
  InventoryWarehouse,
} from '../../../../shared/service-proxies/service-proxies';

/** The warehouse register. */
@Component({
  selector: 'app-warehouses-page',
  imports: [NgIcon, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './warehouses.page.html',
})
export class WarehousesPage {
  private readonly proxy = inject(InventoryServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly canManage = computed(() => this.auth.hasPermission(Permissions.warehousesManage));

  readonly tableConfig = computed<TableConfig<InventoryWarehouse>>(() => ({
    id: 'inventory-warehouses',
    rowKey: (w) => w.id,
    columns: [
      col.text<InventoryWarehouse>('code', 'Code').sortable().width('110px'),
      col.text<InventoryWarehouse>('name', 'Name').sortable(),
      col
        .text<InventoryWarehouse>('location', 'Location')
        .value((w) => [w.city, w.region, w.country].filter(Boolean).join(', ') || '—'),
      col.text<InventoryWarehouse>('contact_name', 'Contact').value((w) => w.contact_name ?? '—'),
      col
        .boolean<InventoryWarehouse>('is_default', 'Default')
        .badgeColors({ true: 'info', false: 'muted' }),
      col
        .boolean<InventoryWarehouse>('allow_negative', 'Negative stock')
        .badgeColors({ true: 'warning', false: 'muted' })
        .hidden(),
      col
        .boolean<InventoryWarehouse>('is_active', 'Active')
        .badgeColors({ true: 'success', false: 'muted' }),
    ],
    defaultSort: 'code',
    defaultSortDir: 'asc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search code or name…',
    columnToggle: true,
    exportPdf: true,
    exportTitle: 'Warehouses',
    actions: this.canManage() ? [{ key: 'edit', label: 'Edit' }] : [],
    emptyText: 'No warehouses yet.',
  }));

  readonly dataSource: TableDataSource<InventoryWarehouse> = clientSideSource(
    () => this.proxy.list_warehouses().pipe(map((rows) => rows ?? [])),
    (w, term) =>
      w.code.toLowerCase().includes(term) ||
      w.name.toLowerCase().includes(term) ||
      (w.city ?? '').toLowerCase().includes(term),
  );

  newWarehouse(): void {
    void this.router.navigate(['/inventory/warehouses/new']);
  }

  onAction(event: { key: string; row: InventoryWarehouse }): void {
    if (event.key === 'edit')
      void this.router.navigate(['/inventory/warehouses', event.row.id, 'edit']);
  }
}
