import { map, of, Observable } from 'rxjs';
import { LookupConfig } from '../../../shared/lookup/lookup-config';
import {
  AccountingServiceProxy,
  AccountingTaxCode,
  InventoryItem,
  InventoryServiceProxy,
  InventoryUom,
  InventoryWarehouse,
  OrderHeader,
  OrderStatus,
  ProcurementServiceProxy,
  ProcurementSupplier,
  TaxDirection,
} from '../../../shared/service-proxies/service-proxies';

/**
 * Shared `<app-lookup>` configurations for the SCM reference entities, so
 * every document form picks items, warehouses and suppliers through the same
 * searchable dropdown-table. All are client-filtered: the backend list
 * endpoints return the full set.
 */

function pageOf<T>(rows: T[], size: number): Observable<{ rows: T[]; total: number }> {
  return of({ rows: rows.slice(0, size), total: rows.length });
}

/** Item picker. Pass a predicate to restrict (e.g. purchasable only). */
export function itemLookup(
  proxy: InventoryServiceProxy,
  filter?: (i: InventoryItem) => boolean,
): LookupConfig<InventoryItem> {
  return {
    dataSource: (q) =>
      proxy.list_items(q.search.trim() || null, null, true).pipe(
        map((all) => {
          const rows = (all ?? []).filter((i) => !filter || filter(i));
          return { rows: rows.slice(0, q.size), total: rows.length };
        }),
      ),
    columns: [
      { label: 'SKU', value: (i) => i.sku, width: '110px' },
      { label: 'Name', value: (i) => i.name },
    ],
    key: (i) => i.id,
    display: (i) => `${i.sku} — ${i.name}`,
    pageSize: 10,
    placeholder: 'Select item…',
    searchPlaceholder: 'Search SKU or name…',
    emptyText: 'No items match.',
  };
}

/** Warehouse picker over the active warehouses. */
export function warehouseLookup(proxy: InventoryServiceProxy): LookupConfig<InventoryWarehouse> {
  return {
    dataSource: (q) =>
      proxy.list_warehouses().pipe(
        map((all) => {
          const s = q.search.trim().toLowerCase();
          const rows = (all ?? []).filter(
            (w) =>
              w.is_active &&
              (!s || w.code.toLowerCase().includes(s) || w.name.toLowerCase().includes(s)),
          );
          return { rows: rows.slice(0, q.size), total: rows.length };
        }),
      ),
    columns: [
      { label: 'Code', value: (w) => w.code, width: '90px' },
      { label: 'Name', value: (w) => w.name },
    ],
    key: (w) => w.id,
    display: (w) => `${w.code} — ${w.name}`,
    placeholder: 'Select warehouse…',
    searchPlaceholder: 'Search code or name…',
    emptyText: 'No warehouses match.',
  };
}

/** Unit-of-measure picker. */
export function uomLookup(proxy: InventoryServiceProxy): LookupConfig<InventoryUom> {
  return {
    dataSource: (q) =>
      proxy.list_uoms().pipe(
        map((all) => {
          const s = q.search.trim().toLowerCase();
          const rows = (all ?? []).filter(
            (u) =>
              u.is_active &&
              (!s || u.code.toLowerCase().includes(s) || u.name.toLowerCase().includes(s)),
          );
          return { rows: rows.slice(0, q.size), total: rows.length };
        }),
      ),
    columns: [
      { label: 'Code', value: (u) => u.code, width: '80px' },
      { label: 'Name', value: (u) => u.name },
      { label: 'Fractional', value: (u) => (u.fractional ? 'yes' : 'no'), width: '90px' },
    ],
    key: (u) => u.id,
    display: (u) => `${u.code} — ${u.name}`,
    placeholder: 'Select unit…',
    searchPlaceholder: 'Search code or name…',
    emptyText: 'No units match.',
  };
}

/** Supplier picker. Pass activeOnly=false to include inactive suppliers. */
export function supplierLookup(
  proxy: ProcurementServiceProxy,
  filter?: (s: ProcurementSupplier) => boolean,
): LookupConfig<ProcurementSupplier> {
  return {
    dataSource: (q) =>
      proxy.list_suppliers().pipe(
        map((all) => {
          const s = q.search.trim().toLowerCase();
          const rows = (all ?? []).filter(
            (r) =>
              (!filter || filter(r)) &&
              (!s || r.code.toLowerCase().includes(s) || r.name.toLowerCase().includes(s)),
          );
          return { rows: rows.slice(0, q.size), total: rows.length };
        }),
      ),
    columns: [
      { label: 'Code', value: (r) => r.code, width: '100px' },
      { label: 'Name', value: (r) => r.name },
      { label: 'Currency', value: (r) => r.currency, width: '80px' },
    ],
    key: (r) => r.id,
    display: (r) => `${r.code} — ${r.name}`,
    pageSize: 10,
    placeholder: 'Select supplier…',
    searchPlaceholder: 'Search code or name…',
    emptyText: 'No suppliers match.',
  };
}

/** Tax-code picker, restricted to one direction (input for purchasing). */
export function taxCodeLookup(
  proxy: AccountingServiceProxy,
  direction: TaxDirection,
): LookupConfig<AccountingTaxCode> {
  return {
    dataSource: (q) =>
      proxy.list_tax_codes().pipe(
        map((all) => {
          const s = q.search.trim().toLowerCase();
          const rows = (all ?? []).filter(
            (t) =>
              t.is_active &&
              t.direction === direction &&
              (!s || t.code.toLowerCase().includes(s) || t.name.toLowerCase().includes(s)),
          );
          return { rows: rows.slice(0, q.size), total: rows.length };
        }),
      ),
    columns: [
      { label: 'Code', value: (t) => t.code, width: '90px' },
      { label: 'Name', value: (t) => t.name },
      { label: 'Rate', value: (t) => `${Number(t.rate)}%`, width: '70px' },
    ],
    key: (t) => t.id,
    display: (t) => `${t.code} (${Number(t.rate)}%)`,
    placeholder: 'No tax',
    searchPlaceholder: 'Search code or name…',
    emptyText: 'No tax codes match.',
  };
}

/**
 * Purchase-order picker for the documents that hang off an order
 * (receipts, returns, invoices). Restricted by status set.
 */
export function orderLookup(
  proxy: ProcurementServiceProxy,
  statuses: OrderStatus[],
): LookupConfig<OrderHeader> {
  return {
    dataSource: (q) =>
      proxy.list_orders(null, null, null, null).pipe(
        map((all) => {
          const s = q.search.trim().toLowerCase();
          const rows = (all ?? []).filter(
            (o) =>
              statuses.includes(o.status) &&
              (!s ||
                (o.number ?? '').toLowerCase().includes(s) ||
                o.supplier_name.toLowerCase().includes(s)),
          );
          return { rows: rows.slice(0, q.size), total: rows.length };
        }),
      ),
    columns: [
      { label: 'Number', value: (o) => o.number ?? '(draft)', width: '130px' },
      { label: 'Supplier', value: (o) => o.supplier_name },
      { label: 'Status', value: (o) => o.status.replaceAll('_', ' '), width: '130px' },
    ],
    key: (o) => o.id,
    display: (o) => `${o.number ?? '(draft)'} — ${o.supplier_name}`,
    pageSize: 10,
    placeholder: 'Select purchase order…',
    searchPlaceholder: 'Search number or supplier…',
    emptyText: 'No matching orders.',
  };
}
