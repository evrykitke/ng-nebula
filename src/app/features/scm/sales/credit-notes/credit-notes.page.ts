import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { map } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { DataTable } from '../../../../shared/datatable/data-table';
import { TableConfig, TableDataSource, col } from '../../../../shared/datatable/table-config';
import { clientSideSource } from '../../../../shared/datatable/client-side';
import { creditNoteStatusTones, fmtDate, fmtMoney, statusLabel } from '../../shared/scm-format';
import {
  CreditNoteHeader,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** Credit notes — reversals of posted sales invoices, optionally restocking goods. */
@Component({
  selector: 'app-credit-notes-page',
  imports: [NgIcon, RouterLink, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './credit-notes.page.html',
})
export class CreditNotesPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.creditNotesCreate));

  readonly tableConfig = computed<TableConfig<CreditNoteHeader>>(() => ({
    id: 'sales-credit-notes',
    rowKey: (c) => c.id,
    columns: [
      col.text<CreditNoteHeader>('number', 'Number').value((c) => c.number ?? '(draft)').width('140px'),
      col.text<CreditNoteHeader>('customer_name', 'Customer').sortable(),
      col.text<CreditNoteHeader>('invoice_number', 'Invoice').value((c) => c.invoice_number ?? '—').width('140px'),
      col.text<CreditNoteHeader>('credit_date', 'Date').value((c) => fmtDate(c.credit_date)).width('120px'),
      col.number<CreditNoteHeader>('total', 'Total').value((c) => fmtMoney(c.total)).align('right'),
      col
        .badge<CreditNoteHeader>('status', 'Status')
        .value((c) => statusLabel(c.status))
        .badgeColors({ draft: 'muted', posted: 'success', cancelled: 'danger' }),
    ],
    defaultSort: 'credit_date',
    defaultSortDir: 'desc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search number, customer or invoice…',
    columnToggle: true,
    exportPdf: true,
    exportTitle: 'Credit Notes',
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No credit notes yet.',
  }));

  readonly tones = creditNoteStatusTones;

  readonly dataSource: TableDataSource<CreditNoteHeader> = clientSideSource(
    () => this.proxy.list_notes(null, null, null).pipe(map((rows) => rows ?? [])),
    (c, term) =>
      (c.number ?? '').toLowerCase().includes(term) ||
      c.customer_name.toLowerCase().includes(term) ||
      (c.invoice_number ?? '').toLowerCase().includes(term),
  );

  onAction(event: { key: string; row: CreditNoteHeader }): void {
    if (event.key === 'view') void this.router.navigate(['/sales/credit-notes', event.row.id]);
  }
}
