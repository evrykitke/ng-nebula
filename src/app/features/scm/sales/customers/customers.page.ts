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
import {
  SalesCustomer,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** The customer master register. */
@Component({
  selector: 'app-customers-page',
  imports: [NgIcon, RouterLink, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customers.page.html',
})
export class CustomersPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.customersCreate));
  readonly canEdit = computed(() => this.auth.hasPermission(Permissions.customersEdit));

  readonly tableConfig = computed<TableConfig<SalesCustomer>>(() => ({
    id: 'sales-customers',
    rowKey: (c) => c.id,
    columns: [
      col.text<SalesCustomer>('code', 'Code').sortable().width('120px'),
      col.text<SalesCustomer>('name', 'Name').sortable(),
      col.text<SalesCustomer>('contact_name', 'Contact').value((c) => c.contact_name ?? '—'),
      col.text<SalesCustomer>('phone', 'Phone').value((c) => c.phone ?? '—').hidden(),
      col.text<SalesCustomer>('currency', 'Ccy').width('70px'),
      col
        .number<SalesCustomer>('payment_terms_days', 'Terms (days)')
        .value((c) => c.payment_terms_days),
      col
        .badge<SalesCustomer>('on_hold', 'Hold')
        .value((c) => (c.on_hold ? 'on hold' : 'ok'))
        .badgeColors({ 'on hold': 'danger', ok: 'muted' }),
      col
        .boolean<SalesCustomer>('is_active', 'Active')
        .badgeColors({ true: 'success', false: 'muted' }),
    ],
    defaultSort: 'code',
    defaultSortDir: 'asc',
    pageSize: 25,
    pageSizeOptions: [25, 50, 100],
    search: true,
    searchPlaceholder: 'Search code, name or contact…',
    columnToggle: true,
    exportPdf: true,
    exportTitle: 'Customers',
    actions: [
      { key: 'view', label: 'View' },
      ...(this.canEdit() ? [{ key: 'edit', label: 'Edit' }] : []),
    ],
    emptyText: 'No customers yet.',
  }));

  readonly dataSource: TableDataSource<SalesCustomer> = clientSideSource(
    () => this.proxy.list_customers().pipe(map((rows) => rows ?? [])),
    (c, term) =>
      c.code.toLowerCase().includes(term) ||
      c.name.toLowerCase().includes(term) ||
      (c.contact_name ?? '').toLowerCase().includes(term),
  );

  newCustomer(): void {
    void this.router.navigate(['/sales/customers/new']);
  }

  onAction(event: { key: string; row: SalesCustomer }): void {
    if (event.key === 'view') void this.router.navigate(['/sales/customers', event.row.id]);
    else if (event.key === 'edit')
      void this.router.navigate(['/sales/customers', event.row.id, 'edit']);
  }
}
