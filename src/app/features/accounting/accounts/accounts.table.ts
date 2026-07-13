import { RowAction, TableConfig, col } from '../../../shared/datatable/table-config';
import { AccountingAccount } from '../../../shared/service-proxies/service-proxies';

/**
 * DataTable configuration for the Chart of Accounts. Row actions are
 * permission-gated by the caller; system accounts hide Delete (the backend
 * refuses it) but may still be edited.
 */
export function accountsTable(opts: {
  canEdit: boolean;
  canDelete: boolean;
  canViewLedger: boolean;
}): TableConfig<AccountingAccount> {
  const actions: RowAction<AccountingAccount>[] = [];
  if (opts.canViewLedger) {
    actions.push({ key: 'ledger', label: 'View ledger', icon: 'lucideBookText' });
  }
  if (opts.canEdit) {
    actions.push({ key: 'edit', label: 'Edit' });
  }
  if (opts.canDelete) {
    actions.push({
      key: 'delete',
      label: 'Delete',
      tone: 'danger',
      visible: (a) => !a.is_system,
    });
  }

  return {
    id: 'accounting-accounts',
    rowKey: (a) => a.id,
    columns: [
      col.text<AccountingAccount>('code', 'Code').sortable().width('110px'),
      col.text<AccountingAccount>('name', 'Name').sortable(),
      col
        .badge<AccountingAccount>('account_type', 'Type')
        .value((a) => a.account_type)
        .badgeColors({
          asset: 'info',
          liability: 'warning',
          equity: 'muted',
          revenue: 'success',
          expense: 'danger',
        }),
      col.text<AccountingAccount>('currency', 'Currency').width('100px'),
      col
        .badge<AccountingAccount>('system_key', 'Role')
        .value((a) => a.system_key ?? '—')
        .badgeColors({ '—': 'muted' }),
      col
        .badge<AccountingAccount>('is_active', 'Status')
        .value((a) => (a.is_active ? 'Active' : 'Inactive'))
        .badgeColors({ Active: 'success', Inactive: 'muted' }),
    ],
    defaultSort: 'code',
    defaultSortDir: 'asc',
    pageSize: 50,
    pageSizeOptions: [20, 50, 100],
    search: true,
    searchPlaceholder: 'Search accounts…',
    columnToggle: true,
    actions,
    emptyText: 'No accounts yet.',
  };
}
