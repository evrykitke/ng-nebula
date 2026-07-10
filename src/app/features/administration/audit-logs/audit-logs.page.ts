import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { DataTable } from '../../../shared/datatable/data-table';
import { TableDataSource } from '../../../shared/datatable/table-config';
import { auditLogsTable } from './audit-logs.table';
import { AuditLogDetailPanel } from './audit-log-detail-panel';
import { AuditLog, AuditServiceProxy } from '../../../shared/service-proxies/service-proxies';

/**
 * Audit Log — a read-only DataTable view of the tenant's trail (newest
 * first). The action / entity-type / user filters are projected into the
 * table toolbar. Clicking a row expands it inline (request context + the
 * recorded change set); the View action opens the full entry page with the
 * timeline. The list endpoint pages by limit/offset without a total, so the
 * source probes one row past the page to know whether more exist.
 */
@Component({
  selector: 'app-audit-logs-page',
  imports: [FormsModule, PageHeader, DataTable, AuditLogDetailPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-logs.page.html',
})
export class AuditLogsPage {
  private readonly proxy = inject(AuditServiceProxy);
  private readonly router = inject(Router);
  private readonly table = viewChild<DataTable<AuditLog>>(DataTable);

  readonly config = auditLogsTable();
  readonly actions = ['request', 'create', 'update', 'delete', 'event'];

  // Externally-owned filters (projected into the table toolbar).
  action = '';
  entityType = '';
  userId: number | null = null;

  /** Data source: the table query supplies paging; the local filters the rest. */
  readonly dataSource: TableDataSource<AuditLog> = (q) =>
    this.proxy
      .list_logs(
        q.size + 1,
        q.page * q.size,
        this.action || undefined,
        this.entityType.trim() || undefined,
        this.userId ?? undefined,
      )
      .pipe(
        map((rows) => {
          const hasMore = rows.length > q.size;
          return {
            rows: rows.slice(0, q.size),
            total: q.page * q.size + Math.min(rows.length, q.size) + (hasMore ? 1 : 0),
          };
        }),
      );

  applyFilters(): void {
    this.table()?.reload(true);
  }

  clearFilters(): void {
    this.action = '';
    this.entityType = '';
    this.userId = null;
    this.applyFilters();
  }

  /** Row click → expand the inline detail panel. */
  toggle(row: AuditLog): void {
    this.table()?.toggleExpand(row);
  }

  /** The "View" action → the full entry page with the timeline. */
  onAction(event: { key: string; row: AuditLog }): void {
    if (event.key === 'view') {
      void this.router.navigate(['/administration/audit-logs', event.row.id]);
    }
  }
}
