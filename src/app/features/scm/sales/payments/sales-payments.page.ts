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
import { fmtDate, fmtMoney, salesPaymentStatusTones, statusLabel } from '../../shared/scm-format';
import {
  SalesPaymentHeader,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** Customer payments — receipts allocated across open invoices. */
@Component({
  selector: 'app-sales-payments-page',
  imports: [NgIcon, RouterLink, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-payments.page.html',
})
export class SalesPaymentsPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.salesPaymentsCreate));

  readonly tableConfig = computed<TableConfig<SalesPaymentHeader>>(() => ({
    id: 'sales-payments',
    rowKey: (p) => p.id,
    columns: [
      col.text<SalesPaymentHeader>('number', 'Number').value((p) => p.number ?? '(draft)').width('140px'),
      col.text<SalesPaymentHeader>('customer_name', 'Customer').sortable(),
      col.text<SalesPaymentHeader>('payment_date', 'Date').value((p) => fmtDate(p.payment_date)).width('120px'),
      col.text<SalesPaymentHeader>('method', 'Method').value((p) => statusLabel(p.method)).width('130px'),
      col.number<SalesPaymentHeader>('amount', 'Amount').value((p) => fmtMoney(p.amount)).align('right'),
      col.text<SalesPaymentHeader>('reference', 'Reference').value((p) => p.reference ?? '—'),
      col
        .badge<SalesPaymentHeader>('status', 'Status')
        .value((p) => statusLabel(p.status))
        .badgeColors({ draft: 'muted', posted: 'success', reversed: 'warning' }),
    ],
    defaultSort: 'payment_date',
    defaultSortDir: 'desc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search number or customer…',
    columnToggle: true,
    exportPdf: true,
    exportTitle: 'Customer Receipts',
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No payments yet.',
  }));

  readonly tones = salesPaymentStatusTones;

  readonly dataSource: TableDataSource<SalesPaymentHeader> = clientSideSource(
    () => this.proxy.list_payments2(null, null, null, null).pipe(map((rows) => rows ?? [])),
    (p, term) =>
      (p.number ?? '').toLowerCase().includes(term) ||
      p.customer_name.toLowerCase().includes(term),
  );

  onAction(event: { key: string; row: SalesPaymentHeader }): void {
    if (event.key === 'view') void this.router.navigate(['/sales/payments', event.row.id]);
  }
}
