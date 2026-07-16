import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { map } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { DataTable } from '../../../../shared/datatable/data-table';
import { TableConfig, TableDataSource, col } from '../../../../shared/datatable/table-config';
import { clientSideSource } from '../../../../shared/datatable/client-side';
import { fmtDate, quotationStatusTones, statusLabel } from '../../shared/scm-format';
import {
  QuotationHeader,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** Sales quotations — offers to customers that can convert into orders. */
@Component({
  selector: 'app-quotations-page',
  imports: [NgIcon, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quotations.page.html',
})
export class QuotationsPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.quotationsCreate));

  readonly tableConfig = computed<TableConfig<QuotationHeader>>(() => ({
    id: 'sales-quotations',
    rowKey: (q) => q.id,
    columns: [
      col.text<QuotationHeader>('number', 'Number').value((q) => q.number ?? '(draft)').width('140px'),
      col.text<QuotationHeader>('customer_name', 'Customer').sortable(),
      col.text<QuotationHeader>('quote_date', 'Date').value((q) => fmtDate(q.quote_date)).width('120px'),
      col
        .text<QuotationHeader>('valid_until', 'Valid until')
        .value((q) => fmtDate(q.valid_until))
        .width('120px'),
      col.text<QuotationHeader>('currency', 'Currency').width('90px'),
      col
        .badge<QuotationHeader>('status', 'Status')
        .value((q) => statusLabel(q.status))
        .badgeColors({
          draft: 'muted',
          sent: 'info',
          accepted: 'success',
          declined: 'danger',
          expired: 'warning',
          converted: 'success',
        }),
    ],
    defaultSort: 'quote_date',
    defaultSortDir: 'desc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search number or customer…',
    columnToggle: true,
    exportPdf: true,
    exportTitle: 'Quotations',
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No quotations yet.',
  }));

  readonly tones = quotationStatusTones;

  readonly dataSource: TableDataSource<QuotationHeader> = clientSideSource(
    () => this.proxy.list_quotations(null, null, null, null).pipe(map((rows) => rows ?? [])),
    (q, term) =>
      (q.number ?? '').toLowerCase().includes(term) ||
      q.customer_name.toLowerCase().includes(term),
  );

  newQuotation(): void {
    void this.router.navigate(['/sales/quotations/new']);
  }

  onAction(event: { key: string; row: QuotationHeader }): void {
    if (event.key === 'view') void this.router.navigate(['/sales/quotations', event.row.id]);
  }
}
