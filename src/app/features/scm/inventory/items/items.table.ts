import { TableConfig, col } from '../../../../shared/datatable/table-config';
import { InventoryItem } from '../../../../shared/service-proxies/service-proxies';
import { fmtMoney, num } from '../../shared/scm-format';

/**
 * DataTable configuration for the item master. Rows open the item detail;
 * editing and deletion live there and in the row actions.
 */
export function itemsTable(opts: {
  canEdit: boolean;
  canDelete: boolean;
  categoryName: (id: string | undefined) => string;
  uomCode: (id: string) => string;
}): TableConfig<InventoryItem> {
  return {
    id: 'inventory-items',
    rowKey: (i) => i.id,
    columns: [
      col.text<InventoryItem>('sku', 'SKU').sortable().width('130px'),
      col.text<InventoryItem>('name', 'Name').sortable(),
      col
        .text<InventoryItem>('category', 'Category')
        .value((i) => opts.categoryName(i.category_id)),
      col
        .badge<InventoryItem>('item_type', 'Type')
        .badgeColors({ stockable: 'info', consumable: 'warning', service: 'muted' }),
      col
        .text<InventoryItem>('uom', 'Unit')
        .value((i) => opts.uomCode(i.uom_id))
        .width('80px'),
      col
        .currency<InventoryItem>('purchase_price', 'Purchase price')
        .value((i) => num(i.purchase_price))
        .formatter((v) => (num(v as number) ? fmtMoney(v as number) : '—')),
      col
        .currency<InventoryItem>('selling_price', 'Selling price')
        .value((i) => num(i.selling_price))
        .formatter((v) => (num(v as number) ? fmtMoney(v as number) : '—'))
        .hidden(),
      col
        .text<InventoryItem>('tracking', 'Tracking')
        .value((i) =>
          [i.track_batches ? 'batches' : '', i.track_serials ? 'serials' : '']
            .filter(Boolean)
            .join(' + ') || '—',
        )
        .hidden(),
      col
        .boolean<InventoryItem>('is_active', 'Active')
        .badgeColors({ true: 'success', false: 'muted' }),
    ],
    defaultSort: 'sku',
    defaultSortDir: 'asc',
    pageSize: 25,
    pageSizeOptions: [25, 50, 100],
    search: true,
    searchPlaceholder: 'Search SKU, name or barcode…',
    columnToggle: true,
    exportPdf: true,
    exportTitle: 'Items',
    actions: [
      { key: 'view', label: 'View' },
      ...(opts.canEdit ? [{ key: 'edit', label: 'Edit' }] : []),
      ...(opts.canDelete ? [{ key: 'delete', label: 'Delete', tone: 'danger' as const }] : []),
    ],
    emptyText: 'No items yet.',
  };
}
