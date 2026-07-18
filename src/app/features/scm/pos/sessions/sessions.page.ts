import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { DataTable } from '../../../../shared/datatable/data-table';
import { TableConfig, TableDataSource, col } from '../../../../shared/datatable/table-config';
import { clientSideSource } from '../../../../shared/datatable/client-side';
import { fmtDateTime, fmtMoney, statusLabel } from '../../shared/scm-format';
import { sessionStatusTones } from '../shared/pos-format';
import {
  PosServiceProxy,
  SessionView,
} from '../../../../shared/service-proxies/service-proxies';

/**
 * Every register session, newest first: the shape of each till day. A row
 * opens the session's report — live X while it runs, stored Z once closed.
 */
@Component({
  selector: 'app-pos-sessions-page',
  imports: [PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sessions.page.html',
})
export class SessionsPage {
  private readonly proxy = inject(PosServiceProxy);
  private readonly router = inject(Router);

  readonly tableConfig = computed<TableConfig<SessionView>>(() => ({
    id: 'pos-sessions',
    rowKey: (s) => s.id,
    columns: [
      col.text<SessionView>('number', 'Session').value((s) => s.number ?? '—').width('150px'),
      col.text<SessionView>('register_code', 'Register').sortable().width('110px'),
      col
        .text<SessionView>('opened_at', 'Opened')
        .value((s) => fmtDateTime(s.opened_at))
        .sortable()
        .width('150px'),
      col
        .text<SessionView>('closed_at', 'Closed')
        .value((s) => fmtDateTime(s.closed_at))
        .width('150px'),
      col
        .number<SessionView>('opening_float', 'Float')
        .value((s) => fmtMoney(s.opening_float))
        .align('right'),
      col
        .number<SessionView>('avg_sale_seconds', 'Sec / sale')
        .value((s) => (s.avg_sale_seconds ? fmtMoney(s.avg_sale_seconds) : '—'))
        .align('right'),
      col
        .number<SessionView>('void_count', 'Voids')
        .value((s) => (s.void_count != null ? String(s.void_count) : '—'))
        .align('right'),
      col
        .badge<SessionView>('status', 'Status')
        .value((s) => statusLabel(s.status))
        .badgeColors(sessionStatusTones),
    ],
    defaultSort: 'opened_at',
    defaultSortDir: 'desc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search session or register…',
    exportPdf: true,
    exportTitle: 'POS Sessions',
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No sessions yet — the till has not been opened.',
  }));

  readonly dataSource: TableDataSource<SessionView> = clientSideSource(
    () => this.proxy.list_sessions(null, null, null, null).pipe(map((rows) => rows ?? [])),
    (s, term) =>
      (s.number ?? '').toLowerCase().includes(term) ||
      s.register_code.toLowerCase().includes(term),
  );

  onAction(event: { key: string; row: SessionView }): void {
    if (event.key === 'view') void this.router.navigate(['/pos/sessions', event.row.id]);
  }
}
