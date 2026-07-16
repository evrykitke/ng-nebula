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
import { fmtDate, fmtMoney, salesInvoiceStatusTones, statusLabel } from '../../shared/scm-format';
import {
  SalesInvoiceHeader,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** Sales invoices — customer bills posting revenue and receivables. */
@Component({
  selector: 'app-sales-invoices-page',
  imports: [NgIcon, RouterLink, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-invoices.page.html',
})
export class SalesInvoicesPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.salesInvoicesCreate));

  readonly tableConfig = computed<TableConfig<SalesInvoiceHeader>>(() => ({
    id: 'sales-invoices',
    rowKey: (i) => i.id,
    columns: [
      col.text<SalesInvoiceHeader>('number', 'Number').value((i) => i.number ?? '(draft)').width('140px'),
      col.text<SalesInvoiceHeader>('customer_name', 'Customer').sortable(),
      col.text<SalesInvoiceHeader>('invoice_date', 'Date').value((i) => fmtDate(i.invoice_date)).width('120px'),
      col.text<SalesInvoiceHeader>('due_date', 'Due').value((i) => fmtDate(i.due_date)).width('120px'),
      col.number<SalesInvoiceHeader>('total', 'Total').value((i) => fmtMoney(i.total)).align('right'),
      col
        .number<SalesInvoiceHeader>('outstanding', 'Outstanding')
        .value((i) => fmtMoney(i.outstanding))
        .align('right'),
      col
        .badge<SalesInvoiceHeader>('settlement', 'Settlement')
        .value((i) => statusLabel(i.settlement))
        .badgeColors({ unpaid: 'muted', partially_paid: 'warning', paid: 'success' }),
      col
        .badge<SalesInvoiceHeader>('status', 'Status')
        .value((i) => statusLabel(i.status))
        .badgeColors({ draft: 'muted', posted: 'success', cancelled: 'danger' }),
    ],
    defaultSort: 'invoice_date',
    defaultSortDir: 'desc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search number or customer…',
    columnToggle: true,
    exportPdf: true,
    exportTitle: 'Sales Invoices',
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No invoices yet.',
  }));

  readonly tones = salesInvoiceStatusTones;

  readonly dataSource: TableDataSource<SalesInvoiceHeader> = clientSideSource(
    () => this.proxy.list_invoices2(null, null, null, null, null).pipe(map((rows) => rows ?? [])),
    (i, term) =>
      (i.number ?? '').toLowerCase().includes(term) ||
      i.customer_name.toLowerCase().includes(term),
  );

  onAction(event: { key: string; row: SalesInvoiceHeader }): void {
    if (event.key === 'view') void this.router.navigate(['/sales/invoices', event.row.id]);
  }
}
