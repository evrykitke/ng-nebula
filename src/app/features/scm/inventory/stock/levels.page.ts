import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { DataTable } from '../../../../shared/datatable/data-table';
import { TableConfig, TableDataSource, col } from '../../../../shared/datatable/table-config';
import { clientSideSource } from '../../../../shared/datatable/client-side';
import { filterSummary, fmtCost, fmtMoney, fmtQty, num } from '../../shared/scm-format';
import {
  InventoryServiceProxy,
  InventoryWarehouse,
  LevelView,
  ValuationSummary,
} from '../../../../shared/service-proxies/service-proxies';

/**
 * The stock position: one row per item × warehouse, with the valuation
 * summary on top. The below-reorder filter doubles as the shortage report.
 */
@Component({
  selector: 'app-stock-levels-page',
  imports: [FormsModule, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './levels.page.html',
})
export class StockLevelsPage {
  private readonly proxy = inject(InventoryServiceProxy);
  private readonly router = inject(Router);

  private readonly table = viewChild<DataTable<LevelView>>(DataTable);

  readonly warehouses = signal<InventoryWarehouse[]>([]);
  readonly valuation = signal<ValuationSummary | null>(null);

  warehouseFilter = '';
  belowReorder = false;

  readonly fmtMoney = fmtMoney;
  readonly fmtQty = fmtQty;

  readonly tableConfig = computed<TableConfig<LevelView>>(() => ({
    id: 'inventory-levels',
    rowKey: (l) => `${l.item_id}:${l.warehouse_id}`,
    columns: [
      col.text<LevelView>('sku', 'SKU').sortable().width('130px'),
      col.text<LevelView>('item_name', 'Item').sortable(),
      col.text<LevelView>('warehouse_code', 'Warehouse').sortable().width('120px'),
      col
        .number<LevelView>('on_hand', 'On hand')
        .value((l) => num(l.on_hand))
        .formatter((v) => fmtQty(v as number)),
      col
        .number<LevelView>('reserved', 'Reserved')
        .value((l) => num(l.reserved))
        .formatter((v) => fmtQty(v as number))
        .hidden(),
      col
        .number<LevelView>('available', 'Available')
        .value((l) => num(l.available))
        .formatter((v) => fmtQty(v as number)),
      col
        .number<LevelView>('on_order', 'On order')
        .value((l) => num(l.on_order))
        .formatter((v) => fmtQty(v as number)),
      col
        .number<LevelView>('reorder_level', 'Reorder at')
        .value((l) => num(l.reorder_level))
        .formatter((v, l) => (l.reorder_level ? fmtQty(v as number) : '—'))
        .hidden(),
      col
        .currency<LevelView>('avg_cost', 'Avg cost')
        .value((l) => num(l.avg_cost))
        .formatter((v) => fmtCost(v as number)),
      col
        .currency<LevelView>('value', 'Value')
        .value((l) => num(l.value))
        .formatter((v) => fmtMoney(v as number)),
      col
        .badge<LevelView>('below_reorder', 'Reorder')
        .value((l) => (l.below_reorder ? 'below' : 'ok'))
        .badgeColors({ below: 'warning', ok: 'muted' }),
    ],
    defaultSort: 'sku',
    defaultSortDir: 'asc',
    pageSize: 25,
    pageSizeOptions: [25, 50, 100],
    search: true,
    searchPlaceholder: 'Search SKU, item or warehouse…',
    columnToggle: true,
    exportPdf: true,
    exportTitle: 'Stock Levels',
    exportSubtitle: () =>
      filterSummary([
        ['Warehouse', this.warehouses().find((w) => w.id === this.warehouseFilter)?.name],
      ]),
    actions: [{ key: 'item', label: 'View item' }],
    emptyText: 'No stock positions match.',
  }));

  readonly dataSource: TableDataSource<LevelView> = clientSideSource(
    () =>
      this.proxy
        .list_levels(this.warehouseFilter || null, null, this.belowReorder)
        .pipe(map((rows) => rows ?? [])),
    (l, term) =>
      l.sku.toLowerCase().includes(term) ||
      l.item_name.toLowerCase().includes(term) ||
      l.warehouse_code.toLowerCase().includes(term),
  );

  constructor() {
    this.proxy.list_warehouses().subscribe({
      next: (all) => this.warehouses.set(all ?? []),
      error: () => {},
    });
    this.loadValuation();
  }

  private loadValuation(): void {
    this.proxy.get_valuation(this.warehouseFilter || null).subscribe({
      next: (v) => this.valuation.set(v),
      error: () => {},
    });
  }

  applyFilters(): void {
    this.table()?.load();
    this.loadValuation();
  }

  onAction(event: { key: string; row: LevelView }): void {
    if (event.key === 'item') void this.router.navigate(['/inventory/items', event.row.item_id]);
  }
}
