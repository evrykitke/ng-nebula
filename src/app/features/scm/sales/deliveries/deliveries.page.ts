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
import { deliveryStatusTones, fmtDate, statusLabel } from '../../shared/scm-format';
import {
  DeliveryHeader,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** Delivery notes — goods issued to customers against sales orders. */
@Component({
  selector: 'app-deliveries-page',
  imports: [NgIcon, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './deliveries.page.html',
})
export class DeliveriesPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.deliveriesCreate));

  readonly tableConfig = computed<TableConfig<DeliveryHeader>>(() => ({
    id: 'sales-deliveries',
    rowKey: (d) => d.id,
    columns: [
      col.text<DeliveryHeader>('number', 'Number').value((d) => d.number ?? '(draft)').width('140px'),
      col.text<DeliveryHeader>('order_number', 'Order').value((d) => d.order_number ?? '—').width('140px'),
      col.text<DeliveryHeader>('delivery_date', 'Date').value((d) => fmtDate(d.delivery_date)).width('120px'),
      col.text<DeliveryHeader>('carrier', 'Carrier').value((d) => d.carrier ?? '—'),
      col
        .badge<DeliveryHeader>('status', 'Status')
        .value((d) => statusLabel(d.status))
        .badgeColors({ draft: 'muted', posted: 'success', reversed: 'warning' }),
    ],
    defaultSort: 'delivery_date',
    defaultSortDir: 'desc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search number or order…',
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No deliveries yet.',
  }));

  readonly tones = deliveryStatusTones;

  readonly dataSource: TableDataSource<DeliveryHeader> = clientSideSource(
    () => this.proxy.list_deliveries(null, null, null, null).pipe(map((rows) => rows ?? [])),
    (d, term) =>
      (d.number ?? '').toLowerCase().includes(term) ||
      (d.order_number ?? '').toLowerCase().includes(term),
  );

  newDelivery(): void {
    void this.router.navigate(['/sales/deliveries/new']);
  }

  onAction(event: { key: string; row: DeliveryHeader }): void {
    if (event.key === 'view') void this.router.navigate(['/sales/deliveries', event.row.id]);
  }
}
