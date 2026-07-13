import { RowAction, TableConfig, col } from '../../../shared/datatable/table-config';
import {
  AccountingAccount,
  AccountingTaxCode,
} from '../../../shared/service-proxies/service-proxies';

/**
 * DataTable configuration for tax codes. The account column resolves the linked
 * account through the supplied lookup; system tax codes hide Delete.
 */
export function taxCodesTable(opts: {
  canEdit: boolean;
  canDelete: boolean;
  accountsById: Map<string, AccountingAccount>;
}): TableConfig<AccountingTaxCode> {
  const actions: RowAction<AccountingTaxCode>[] = [];
  if (opts.canEdit) actions.push({ key: 'edit', label: 'Edit' });
  if (opts.canDelete) {
    actions.push({
      key: 'delete',
      label: 'Delete',
      tone: 'danger',
      visible: (t) => !t.is_system,
    });
  }

  return {
    id: 'accounting-tax-codes',
    rowKey: (t) => t.id,
    columns: [
      col.text<AccountingTaxCode>('code', 'Code').sortable().width('130px'),
      col.text<AccountingTaxCode>('name', 'Name').sortable(),
      col
        .text<AccountingTaxCode>('rate', 'Rate')
        .align('right')
        .width('90px')
        .value((t) => `${Number(t.rate)}%`),
      col
        .badge<AccountingTaxCode>('direction', 'Direction')
        .value((t) => t.direction)
        .badgeColors({ output: 'info', input: 'warning' }),
      col.text<AccountingTaxCode>('account_id', 'Account').value((t) => {
        if (!t.account_id) return '—';
        const a = opts.accountsById.get(t.account_id);
        return a ? `${a.code} — ${a.name}` : t.account_id;
      }),
      col
        .badge<AccountingTaxCode>('is_active', 'Status')
        .value((t) => (t.is_active ? 'Active' : 'Inactive'))
        .badgeColors({ Active: 'success', Inactive: 'muted' }),
    ],
    defaultSort: 'code',
    defaultSortDir: 'asc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search tax codes…',
    columnToggle: true,
    actions,
    emptyText: 'No tax codes yet.',
  };
}
