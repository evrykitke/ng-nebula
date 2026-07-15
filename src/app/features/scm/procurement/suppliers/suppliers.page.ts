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
import {
  ProcurementServiceProxy,
  ProcurementSupplier,
} from '../../../../shared/service-proxies/service-proxies';

/** The supplier master register. */
@Component({
  selector: 'app-suppliers-page',
  imports: [NgIcon, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suppliers.page.html',
})
export class SuppliersPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.suppliersCreate));
  readonly canEdit = computed(() => this.auth.hasPermission(Permissions.suppliersEdit));

  readonly tableConfig = computed<TableConfig<ProcurementSupplier>>(() => ({
    id: 'procurement-suppliers',
    rowKey: (s) => s.id,
    columns: [
      col.text<ProcurementSupplier>('code', 'Code').sortable().width('120px'),
      col.text<ProcurementSupplier>('name', 'Name').sortable(),
      col.text<ProcurementSupplier>('contact_name', 'Contact').value((s) => s.contact_name ?? '—'),
      col.text<ProcurementSupplier>('phone', 'Phone').value((s) => s.phone ?? '—').hidden(),
      col.text<ProcurementSupplier>('currency', 'Currency').width('90px'),
      col
        .number<ProcurementSupplier>('payment_terms_days', 'Terms (days)')
        .value((s) => s.payment_terms_days),
      col
        .badge<ProcurementSupplier>('on_hold', 'Hold')
        .value((s) => (s.on_hold ? 'on hold' : 'ok'))
        .badgeColors({ 'on hold': 'danger', ok: 'muted' }),
      col
        .boolean<ProcurementSupplier>('is_active', 'Active')
        .badgeColors({ true: 'success', false: 'muted' }),
    ],
    defaultSort: 'code',
    defaultSortDir: 'asc',
    pageSize: 25,
    pageSizeOptions: [25, 50, 100],
    search: true,
    searchPlaceholder: 'Search code, name or contact…',
    columnToggle: true,
    actions: [
      { key: 'view', label: 'View' },
      ...(this.canEdit() ? [{ key: 'edit', label: 'Edit' }] : []),
    ],
    emptyText: 'No suppliers yet.',
  }));

  readonly dataSource: TableDataSource<ProcurementSupplier> = clientSideSource(
    () => this.proxy.list_suppliers().pipe(map((rows) => rows ?? [])),
    (s, term) =>
      s.code.toLowerCase().includes(term) ||
      s.name.toLowerCase().includes(term) ||
      (s.contact_name ?? '').toLowerCase().includes(term),
  );

  newSupplier(): void {
    void this.router.navigate(['/procurement/suppliers/new']);
  }

  onAction(event: { key: string; row: ProcurementSupplier }): void {
    if (event.key === 'view') void this.router.navigate(['/procurement/suppliers', event.row.id]);
    else if (event.key === 'edit')
      void this.router.navigate(['/procurement/suppliers', event.row.id, 'edit']);
  }
}
