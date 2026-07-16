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
import { filterSummary, moveStatusTones, statusLabel } from '../../shared/scm-format';
import {
  InventoryServiceProxy,
  InventoryWarehouse,
  MoveHeader,
  MoveStatus,
  MoveType,
} from '../../../../shared/service-proxies/service-proxies';

/** The stock movement register — receipts, issues, transfers and adjustments. */
@Component({
  selector: 'app-movements-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movements.page.html',
})
export class MovementsPage {
  private readonly proxy = inject(InventoryServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly table = viewChild<DataTable<MoveHeader>>(DataTable);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.movementsCreate));

  readonly warehouses = signal<InventoryWarehouse[]>([]);
  private readonly warehouseCodes = computed(
    () => new Map(this.warehouses().map((w) => [w.id, w.code])),
  );

  readonly moveTypes: MoveType[] = ['receipt', 'issue', 'transfer', 'adjustment'];

  typeFilter: '' | MoveType = '';
  statusFilter: '' | MoveStatus = '';
  warehouseFilter = '';

  readonly statusLabel = statusLabel;

  readonly tableConfig = computed<TableConfig<MoveHeader>>(() => ({
    id: 'inventory-movements',
    rowKey: (m) => m.id,
    columns: [
      col.text<MoveHeader>('number', 'Number').value((m) => m.number ?? '(draft)').width('140px'),
      col.date<MoveHeader>('entry_date', 'Date').sortable().width('110px'),
      col
        .badge<MoveHeader>('move_type', 'Type')
        .badgeColors({
          receipt: 'success',
          issue: 'info',
          transfer: 'muted',
          adjustment: 'warning',
        }),
      col
        .text<MoveHeader>('from_wh', 'From')
        .value((m) => this.whCode(m.from_warehouse_id)),
      col.text<MoveHeader>('to_wh', 'To').value((m) => this.whCode(m.to_warehouse_id)),
      col.text<MoveHeader>('reference', 'Reference').value((m) => m.reference || '—').hidden(),
      col.text<MoveHeader>('memo', 'Memo').value((m) => m.memo || '—'),
      col
        .badge<MoveHeader>('status', 'Status')
        .badgeColors(moveStatusTones as Record<string, 'success' | 'warning' | 'muted'>),
    ],
    defaultSort: 'entry_date',
    defaultSortDir: 'desc',
    pageSize: 25,
    pageSizeOptions: [25, 50, 100],
    search: true,
    searchPlaceholder: 'Search number, reference or memo…',
    columnToggle: true,
    exportPdf: true,
    exportTitle: 'Stock Movements',
    exportSubtitle: () =>
      filterSummary([
        ['Type', statusLabel(this.typeFilter)],
        ['Status', statusLabel(this.statusFilter)],
        ['Warehouse', this.warehouses().find((w) => w.id === this.warehouseFilter)?.name],
      ]),
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No movements match.',
  }));

  readonly dataSource: TableDataSource<MoveHeader> = clientSideSource(
    () =>
      this.proxy
        .list_moves(
          this.typeFilter || null,
          this.statusFilter || null,
          this.warehouseFilter || null,
          null,
          null,
        )
        .pipe(map((rows) => rows ?? [])),
    (m, term) =>
      (m.number ?? '').toLowerCase().includes(term) ||
      (m.reference ?? '').toLowerCase().includes(term) ||
      m.memo.toLowerCase().includes(term),
  );

  constructor() {
    this.proxy.list_warehouses().subscribe({
      next: (all) => this.warehouses.set(all ?? []),
      error: () => {},
    });
  }

  private whCode(id: string | undefined): string {
    return id ? (this.warehouseCodes().get(id) ?? '—') : '—';
  }

  applyFilters(): void {
    this.table()?.load();
  }

  newMove(type: MoveType): void {
    void this.router.navigate(['/inventory/movements/new', type]);
  }

  onAction(event: { key: string; row: MoveHeader }): void {
    if (event.key === 'view') void this.router.navigate(['/inventory/movements', event.row.id]);
  }
}
