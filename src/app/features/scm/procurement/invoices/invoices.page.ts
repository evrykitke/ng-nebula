import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { DataTable } from '../../../../shared/datatable/data-table';
import { TableConfig, TableDataSource, col } from '../../../../shared/datatable/table-config';
import { clientSideSource } from '../../../../shared/datatable/client-side';
import { invoiceStatusTones, statusLabel } from '../../shared/scm-format';
import {
  InvoiceHeader,
  InvoiceStatus,
  ProcurementServiceProxy,
  ProcurementSupplier,
} from '../../../../shared/service-proxies/service-proxies';

/** The purchase invoice (supplier bill) register. */
@Component({
  selector: 'app-invoices-page',
  imports: [FormsModule, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoices.page.html',
})
export class InvoicesPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly router = inject(Router);

  private readonly table = viewChild<DataTable<InvoiceHeader>>(DataTable);

  readonly suppliers = signal<ProcurementSupplier[]>([]);

  statusFilter: '' | InvoiceStatus = '';
  supplierFilter = '';

  readonly statusLabel = statusLabel;

  readonly tableConfig = computed<TableConfig<InvoiceHeader>>(() => ({
    id: 'procurement-invoices',
    rowKey: (i) => i.id,
    columns: [
      col.text<InvoiceHeader>('number', 'Number').value((i) => i.number ?? '(draft)').width('150px'),
      col.text<InvoiceHeader>('supplier_invoice_no', 'Supplier no.').width('140px'),
      col.date<InvoiceHeader>('invoice_date', 'Date').sortable().width('120px'),
      col.text<InvoiceHeader>('supplier_name', 'Supplier').sortable(),
      col.date<InvoiceHeader>('due_date', 'Due').width('120px'),
      col.text<InvoiceHeader>('currency', 'Ccy').width('70px'),
      col
        .badge<InvoiceHeader>('status', 'Status')
        .value((i) => statusLabel(i.status))
        .badgeColors(invoiceStatusTones as Record<string, 'success' | 'danger' | 'muted'>),
    ],
    defaultSort: 'invoice_date',
    defaultSortDir: 'desc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search number, supplier no. or supplier…',
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No purchase invoices match.',
  }));

  readonly dataSource: TableDataSource<InvoiceHeader> = clientSideSource(
    () =>
      this.proxy
        .list_invoices(this.supplierFilter || null, null, this.statusFilter || null, null, null)
        .pipe(map((rows) => rows ?? [])),
    (i, term) =>
      (i.number ?? '').toLowerCase().includes(term) ||
      i.supplier_invoice_no.toLowerCase().includes(term) ||
      i.supplier_name.toLowerCase().includes(term),
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

  onAction(event: { key: string; row: InvoiceHeader }): void {
    if (event.key === 'view') void this.router.navigate(['/procurement/invoices', event.row.id]);
  }
}
