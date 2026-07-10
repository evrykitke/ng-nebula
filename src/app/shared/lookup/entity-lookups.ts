import { map } from 'rxjs';
import { LookupConfig } from './lookup-config';
import { Currency, CurrencyServiceProxy } from '../service-proxies/service-proxies';

/**
 * Shared `<app-lookup>` table-picker configurations for the framework's
 * reference entities, so every form selects them through the same searchable
 * dropdown-table. Consistency by construction.
 */

/** Currency picker (client-filtered over the full seeded list). */
export function currencyLookup(proxy: CurrencyServiceProxy): LookupConfig<Currency> {
  return {
    dataSource: (q) =>
      proxy.list_currencies().pipe(
        map((all) => {
          const s = q.search.toLowerCase();
          const rows = all.filter(
            (c) => !s || c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s),
          );
          return { rows: rows.slice(0, q.size), total: rows.length };
        }),
      ),
    columns: [
      { label: 'Code', value: (c) => c.code, width: '90px' },
      { label: 'Name', value: (c) => c.name },
      { label: 'Decimals', value: (c) => String(c.minor_units), width: '90px' },
    ],
    key: (c) => c.code,
    display: (c) => `${c.code} — ${c.name}`,
    placeholder: 'Select currency…',
    searchPlaceholder: 'Search code or name…',
    emptyText: 'No currencies match.',
  };
}
