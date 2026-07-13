import { TableConfig, col } from '../../../shared/datatable/table-config';
import { JournalEntryHeader } from '../../../shared/service-proxies/service-proxies';

/**
 * DataTable configuration for the expense register. A voucher is a posted
 * journal entry; `view` opens it in the journal detail (reversal happens
 * there).
 */
export function expensesTable(): TableConfig<JournalEntryHeader> {
  return {
    id: 'accounting-expenses',
    rowKey: (e) => e.id,
    columns: [
      col
        .text<JournalEntryHeader>('number', 'Voucher')
        .value((e) => e.number ?? '—')
        .sortable()
        .width('150px'),
      col.date<JournalEntryHeader>('entry_date', 'Date').sortable().width('130px'),
      col.text<JournalEntryHeader>('memo', 'What for'),
      col.text<JournalEntryHeader>('reference', 'Reference').value((e) => e.reference ?? '—'),
      col
        .currency<JournalEntryHeader>('amount', 'Total')
        .value((e) => Number(e.amount)),
      col.text<JournalEntryHeader>('currency', 'Ccy').width('80px'),
      col
        .badge<JournalEntryHeader>('status', 'Status')
        .value((e) => e.status)
        .badgeColors({ posted: 'success', reversed: 'warning' }),
    ],
    defaultSort: 'entry_date',
    defaultSortDir: 'desc',
    pageSize: 25,
    pageSizeOptions: [25, 50, 100],
    search: true,
    searchPlaceholder: 'Search memo / reference / voucher…',
    columnToggle: true,
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No expenses recorded yet.',
  };
}
