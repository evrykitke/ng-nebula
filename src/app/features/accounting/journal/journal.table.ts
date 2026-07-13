import { TableConfig, col } from '../../../shared/datatable/table-config';
import { JournalEntryHeader } from '../../../shared/service-proxies/service-proxies';

/**
 * DataTable configuration for the journal register. Every row opens the entry
 * detail (the single `view` action); posting and reversal happen there.
 */
export function journalTable(): TableConfig<JournalEntryHeader> {
  return {
    id: 'accounting-journal',
    rowKey: (e) => e.id,
    columns: [
      col
        .text<JournalEntryHeader>('number', 'Number')
        .value((e) => e.number ?? '(draft)')
        .sortable()
        .width('150px'),
      col.date<JournalEntryHeader>('entry_date', 'Date').sortable().width('130px'),
      col.text<JournalEntryHeader>('memo', 'Memo'),
      col.text<JournalEntryHeader>('reference', 'Reference').value((e) => e.reference ?? '—'),
      col
        .currency<JournalEntryHeader>('amount', 'Amount')
        .value((e) => Number(e.amount)),
      col.text<JournalEntryHeader>('currency', 'Ccy').width('80px'),
      col
        .badge<JournalEntryHeader>('status', 'Status')
        .value((e) => e.status)
        .badgeColors({ draft: 'muted', posted: 'success', reversed: 'warning' }),
    ],
    defaultSort: 'entry_date',
    defaultSortDir: 'desc',
    pageSize: 25,
    pageSizeOptions: [25, 50, 100],
    search: true,
    searchPlaceholder: 'Search memo / reference / number…',
    columnToggle: true,
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No journal entries yet.',
  };
}
