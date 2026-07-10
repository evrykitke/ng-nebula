/**
 * Client-side adapter for `TableDataSource`. Nebula list endpoints that return
 * the full set in one response (users, roles) plug into the data table through
 * this: the whole list is fetched per query and searched / sorted / paged in
 * memory. Endpoints with server-side paging write their own data source.
 */
import { map } from 'rxjs';
import { DateTime } from 'luxon';
import { TableDataSource, TablePage } from './table-config';
import { Observable } from 'rxjs';

function comparable(value: unknown): string | number {
  if (value instanceof DateTime) return value.toMillis();
  if (typeof value === 'number' || typeof value === 'boolean') return Number(value);
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase();
}

export function clientSideSource<T>(
  fetchAll: () => Observable<T[]>,
  matches: (row: T, term: string) => boolean,
): TableDataSource<T> {
  return (q) =>
    fetchAll().pipe(
      map((all): TablePage<T> => {
        let rows = all;
        const term = q.search.trim().toLowerCase();
        if (term) rows = rows.filter((r) => matches(r, term));
        if (q.sort) {
          const key = q.sort;
          const dir = q.sortDir === 'asc' ? 1 : -1;
          rows = [...rows].sort((a, b) => {
            const av = comparable((a as Record<string, unknown>)[key]);
            const bv = comparable((b as Record<string, unknown>)[key]);
            return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
          });
        }
        const start = q.page * q.size;
        return { rows: rows.slice(start, start + q.size), total: rows.length };
      }),
    );
}
