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
import { priceListStatusTones } from '../../shared/scm-format';
import {
  SalesPriceList,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** Price lists — default, group and customer-scoped catalogues. */
@Component({
  selector: 'app-price-lists-page',
  imports: [NgIcon, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-lists.page.html',
})
export class PriceListsPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly canManage = computed(() => this.auth.hasPermission(Permissions.pricingManage));

  readonly tableConfig = computed<TableConfig<SalesPriceList>>(() => ({
    id: 'sales-price-lists',
    rowKey: (l) => l.id,
    columns: [
      col.text<SalesPriceList>('name', 'Name').sortable(),
      col.text<SalesPriceList>('scope', 'Scope').width('110px'),
      col.text<SalesPriceList>('currency', 'Currency').width('90px'),
      col
        .boolean<SalesPriceList>('tax_inclusive', 'Tax incl.')
        .badgeColors({ true: 'info', false: 'muted' }),
      col
        .boolean<SalesPriceList>('is_promotional', 'Promo')
        .badgeColors({ true: 'warning', false: 'muted' }),
      col
        .badge<SalesPriceList>('status', 'Status')
        .value((l) => l.status)
        .badgeColors({
          active: 'success',
          draft: 'muted',
          archived: 'muted',
        }),
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search name…',
    columnToggle: true,
    exportPdf: true,
    exportTitle: 'Price Lists',
    actions: [{ key: 'view', label: 'View' }],
    emptyText: 'No price lists yet.',
  }));

  readonly tones = priceListStatusTones;

  readonly dataSource: TableDataSource<SalesPriceList> = clientSideSource(
    () => this.proxy.list_lists().pipe(map((rows) => rows ?? [])),
    (l, term) => l.name.toLowerCase().includes(term),
  );

  newList(): void {
    void this.router.navigate(['/sales/price-lists/new']);
  }

  onAction(event: { key: string; row: SalesPriceList }): void {
    if (event.key === 'view') void this.router.navigate(['/sales/price-lists', event.row.id]);
  }
}
