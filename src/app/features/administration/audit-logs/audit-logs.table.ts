import { TableConfig, col } from '../../../shared/datatable/table-config';
import { AuditLog } from '../../../shared/service-proxies/service-proxies';

/**
 * DataTable configuration for the audit trail. Read-only: rows come newest
 * first from the server; filtering happens through the toolbar controls the
 * page projects in (action / entity type / user), not the search box.
 */
export function auditLogsTable(): TableConfig<AuditLog> {
  return {
    id: 'audit-logs',
    rowKey: (l) => String(l.id),
    columns: [
      col.number<AuditLog>('id', '#').sortable(false).width('70px'),
      col.datetime<AuditLog>('created_at', 'When').sortable(false),
      col
        .badge<AuditLog>('action', 'Action')
        .badgeColors({
          request: 'muted',
          create: 'success',
          update: 'info',
          delete: 'danger',
          event: 'warning',
        }),
      col
        .text<AuditLog>('entity_type', 'Entity')
        .sortable(false)
        .value((l) => (l.entity_type ? `${l.entity_type}${l.entity_id ? ' #' + l.entity_id : ''}` : l.message ?? '')),
      col.text<AuditLog>('method', 'Method').sortable(false).width('90px'),
      col.text<AuditLog>('path', 'Path').sortable(false),
      col.number<AuditLog>('status_code', 'Status').sortable(false).width('80px'),
      col.number<AuditLog>('user_id', 'User').sortable(false).width('80px').hidden(),
      col.number<AuditLog>('duration_ms', 'ms').sortable(false).width('80px').hidden(),
      col.text<AuditLog>('ip_address', 'IP').sortable(false).hidden(),
    ],
    pageSize: 25,
    pageSizeOptions: [25, 50, 100],
    search: false,
    columnToggle: true,
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No audit entries match the filters.',
  };
}
