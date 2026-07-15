import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { map } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { DataTable } from '../../../../shared/datatable/data-table';
import { TableDataSource } from '../../../../shared/datatable/table-config';
import { clientSideSource } from '../../../../shared/datatable/client-side';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { itemsTable } from './items.table';
import {
  InventoryCategory,
  InventoryItem,
  InventoryServiceProxy,
  InventoryUom,
} from '../../../../shared/service-proxies/service-proxies';

/** The item master register. */
@Component({
  selector: 'app-items-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './items.page.html',
})
export class ItemsPage {
  private readonly proxy = inject(InventoryServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  private readonly table = viewChild<DataTable<InventoryItem>>(DataTable);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.itemsCreate));
  readonly canEdit = computed(() => this.auth.hasPermission(Permissions.itemsEdit));
  readonly canDelete = computed(() => this.auth.hasPermission(Permissions.itemsDelete));

  readonly categories = signal<InventoryCategory[]>([]);
  readonly uoms = signal<InventoryUom[]>([]);

  private readonly categoriesById = computed(
    () => new Map(this.categories().map((c) => [c.id, c.name])),
  );
  private readonly uomsById = computed(() => new Map(this.uoms().map((u) => [u.id, u.code])));

  /** Filters applied server-side via the list endpoint. */
  categoryFilter = '';
  activeFilter: '' | 'true' | 'false' = 'true';

  readonly tableConfig = computed(() =>
    itemsTable({
      canEdit: this.canEdit(),
      canDelete: this.canDelete(),
      categoryName: (id) => (id ? (this.categoriesById().get(id) ?? '—') : '—'),
      uomCode: (id) => this.uomsById().get(id) ?? '—',
    }),
  );

  readonly dataSource: TableDataSource<InventoryItem> = clientSideSource(
    () =>
      this.proxy
        .list_items(
          null,
          this.categoryFilter || null,
          this.activeFilter === '' ? null : this.activeFilter === 'true',
        )
        .pipe(map((rows) => rows ?? [])),
    (i, term) =>
      i.sku.toLowerCase().includes(term) ||
      i.name.toLowerCase().includes(term) ||
      (i.barcode ?? '').toLowerCase().includes(term),
  );

  constructor() {
    this.proxy.list_categories().subscribe({
      next: (all) => this.categories.set(all ?? []),
      error: () => {},
    });
    this.proxy.list_uoms().subscribe({
      next: (all) => this.uoms.set(all ?? []),
      error: () => {},
    });
  }

  applyFilters(): void {
    this.table()?.load();
  }

  newItem(): void {
    void this.router.navigate(['/inventory/items/new']);
  }

  onAction(event: { key: string; row: InventoryItem }): void {
    if (event.key === 'view') void this.router.navigate(['/inventory/items', event.row.id]);
    else if (event.key === 'edit')
      void this.router.navigate(['/inventory/items', event.row.id, 'edit']);
    else if (event.key === 'delete') void this.remove(event.row);
  }

  private async remove(item: InventoryItem): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Delete ${item.sku}?`,
      message: 'An item that has stock movements cannot be deleted — deactivate it instead.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.proxy.delete_item(item.id).subscribe({
      next: () => {
        this.notify.success('Item deleted');
        this.table()?.load();
      },
      error: (err) => this.notify.error(apiErrorInfo(err).message || 'Delete failed'),
    });
  }
}
