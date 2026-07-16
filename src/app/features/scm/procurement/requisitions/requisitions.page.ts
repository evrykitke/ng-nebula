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
import { filterSummary, requisitionStatusTones, statusLabel } from '../../shared/scm-format';
import {
  InventoryServiceProxy,
  InventoryWarehouse,
  ProcurementServiceProxy,
  RequisitionHeader,
  RequisitionStatus,
} from '../../../../shared/service-proxies/service-proxies';

/** The purchase requisition register. */
@Component({
  selector: 'app-requisitions-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './requisitions.page.html',
})
export class RequisitionsPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly inventory = inject(InventoryServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly table = viewChild<DataTable<RequisitionHeader>>(DataTable);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.requisitionsCreate));

  readonly warehouses = signal<InventoryWarehouse[]>([]);

  statusFilter: '' | RequisitionStatus = '';
  warehouseFilter = '';

  readonly statusLabel = statusLabel;

  readonly tableConfig = computed<TableConfig<RequisitionHeader>>(() => ({
    id: 'procurement-requisitions',
    rowKey: (r) => r.id,
    columns: [
      col.text<RequisitionHeader>('number', 'Number').value((r) => r.number ?? '(draft)').width('150px'),
      col.text<RequisitionHeader>('warehouse_code', 'Warehouse').sortable(),
      col.date<RequisitionHeader>('needed_by', 'Needed by').width('130px'),
      col
        .badge<RequisitionHeader>('status', 'Status')
        .value((r) => statusLabel(r.status))
        .badgeColors(requisitionStatusTones as Record<string, 'success' | 'info' | 'danger' | 'muted'>),
    ],
    defaultSort: 'number',
    defaultSortDir: 'desc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search number…',
    columnToggle: true,
    exportPdf: true,
    exportTitle: 'Purchase Requisitions',
    exportSubtitle: () =>
      filterSummary([
        ['Status', statusLabel(this.statusFilter)],
        ['Warehouse', this.warehouses().find((w) => w.id === this.warehouseFilter)?.name],
      ]),
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No requisitions match.',
  }));

  readonly dataSource: TableDataSource<RequisitionHeader> = clientSideSource(
    () =>
      this.proxy
        .list_requisitions(this.statusFilter || null, this.warehouseFilter || null)
        .pipe(map((rows) => rows ?? [])),
    (r, term) =>
      (r.number ?? '').toLowerCase().includes(term) ||
      r.warehouse_code.toLowerCase().includes(term),
  );

  constructor() {
    this.inventory.list_warehouses().subscribe({
      next: (all) => this.warehouses.set(all ?? []),
      error: () => {},
    });
  }

  applyFilters(): void {
    this.table()?.load();
  }

  newRequisition(): void {
    void this.router.navigate(['/procurement/requisitions/new']);
  }

  onAction(event: { key: string; row: RequisitionHeader }): void {
    if (event.key === 'view')
      void this.router.navigate(['/procurement/requisitions', event.row.id]);
  }
}
