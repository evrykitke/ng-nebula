import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { map } from 'rxjs';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { UiButton } from '../../../../shared/ui/button';
import { DataTable } from '../../../../shared/datatable/data-table';
import { TableConfig, TableDataSource, col } from '../../../../shared/datatable/table-config';
import { clientSideSource } from '../../../../shared/datatable/client-side';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { fmtMoney, paymentStatusTones, statusLabel } from '../../shared/scm-format';
import {
  PaymentHeader,
  PaymentStatus,
  ProcurementServiceProxy,
  ProcurementSupplier,
} from '../../../../shared/service-proxies/service-proxies';

/** The supplier-payment register: money paid out against posted invoices. */
@Component({
  selector: 'app-payments-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payments.page.html',
})
export class PaymentsPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private readonly table = viewChild<DataTable<PaymentHeader>>(DataTable);

  readonly suppliers = signal<ProcurementSupplier[]>([]);
  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.paymentsCreate));

  statusFilter: '' | PaymentStatus = '';
  supplierFilter = '';

  readonly statusLabel = statusLabel;

  readonly tableConfig = computed<TableConfig<PaymentHeader>>(() => ({
    id: 'procurement-payments',
    rowKey: (p) => p.id,
    columns: [
      col.text<PaymentHeader>('number', 'Number').value((p) => p.number ?? '(draft)').width('150px'),
      col.date<PaymentHeader>('payment_date', 'Date').sortable().width('120px'),
      col.text<PaymentHeader>('supplier_name', 'Supplier').sortable(),
      col.text<PaymentHeader>('method', 'Method').value((p) => statusLabel(p.method)).width('130px'),
      col.text<PaymentHeader>('reference', 'Reference').value((p) => p.reference ?? '—').width('130px'),
      col.text<PaymentHeader>('currency', 'Ccy').width('70px'),
      col.text<PaymentHeader>('amount', 'Amount').value((p) => fmtMoney(p.amount)).align('right').width('130px'),
      col
        .badge<PaymentHeader>('status', 'Status')
        .value((p) => statusLabel(p.status))
        .badgeColors(paymentStatusTones as Record<string, 'success' | 'warning' | 'muted'>),
    ],
    defaultSort: 'payment_date',
    defaultSortDir: 'desc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search number, supplier or reference…',
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No supplier payments match.',
  }));

  readonly dataSource: TableDataSource<PaymentHeader> = clientSideSource(
    () =>
      this.proxy
        .list_payments(this.supplierFilter || null, this.statusFilter || null, null, null)
        .pipe(map((rows) => rows ?? [])),
    (p, term) =>
      (p.number ?? '').toLowerCase().includes(term) ||
      p.supplier_name.toLowerCase().includes(term) ||
      (p.reference ?? '').toLowerCase().includes(term),
  );

  constructor() {
    this.proxy.list_suppliers().subscribe({
      next: (all) => this.suppliers.set(all ?? []),
      error: () => {},
    });
  }

  applyFilters(): void {
    this.table()?.load();
  }

  newPayment(): void {
    void this.router.navigate(['/procurement/payments/new']);
  }

  onAction(event: { key: string; row: PaymentHeader }): void {
    if (event.key === 'view') void this.router.navigate(['/procurement/payments', event.row.id]);
  }
}
