import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { PageSkeleton } from '../../../../shared/ui/skeleton';
import { Modal } from '../../../../shared/ui/modal';
import { Lookup } from '../../../../shared/lookup/lookup';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { optDec as dec, optInt as int } from '../../../../shared/forms/numeric';
import { fmtCost, fmtDate } from '../../shared/scm-format';
import { itemLookup } from '../../shared/scm-lookups';
import {
  InventoryItem,
  InventoryServiceProxy,
  ItemSupplierBody,
  ProcurementItemSupplier,
  ProcurementServiceProxy,
  ProcurementSupplier,
} from '../../../../shared/service-proxies/service-proxies';

type Tab = 'profile' | 'catalog';

/** One supplier: master data and the item catalog (supplier-specific pricing and SKUs). */
@Component({
  selector: 'app-supplier-detail-page',
  imports: [PageSkeleton, FormsModule, RouterLink, NgIcon, UiButton, Modal, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './supplier-detail.page.html',
})
export class SupplierDetailPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly inventory = inject(InventoryServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canEdit = computed(() => this.auth.hasPermission(Permissions.suppliersEdit));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly supplier = signal<ProcurementSupplier | null>(null);
  readonly tab = signal<Tab>('profile');

  readonly catalog = signal<ProcurementItemSupplier[]>([]);
  private readonly itemNames = signal<Map<string, string>>(new Map());

  // catalog entry modal
  readonly catalogModal = signal(false);
  readonly catalogSaving = signal(false);
  readonly catalogError = signal<string | null>(null);
  catalogForm = {
    item_id: '',
    item_label: '',
    supplier_sku: '',
    supplier_item_name: '',
    pack_qty: '',
    min_order_qty: '',
    lead_time_days: '',
    is_preferred: false,
    is_active: true,
    notes: '',
  };

  readonly itemLookup = itemLookup(this.inventory, (i) => i.is_purchasable);

  private id = '';

  readonly fmtCost = fmtCost;
  readonly fmtDate = fmtDate;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.id = params.get('id') ?? '';
      this.load();
    });
    this.inventory.list_items(null, null, null).subscribe({
      next: (all) => this.itemNames.set(new Map((all ?? []).map((i) => [i.id, `${i.sku} — ${i.name}`]))),
      error: () => {},
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.proxy.get_supplier(this.id).subscribe({
      next: (s) => {
        this.supplier.set(s);
        this.loading.set(false);
        this.loadCatalog();
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the supplier.');
        this.loading.set(false);
      },
    });
  }

  private loadCatalog(): void {
    this.proxy.list_catalog(this.id).subscribe({
      next: (rows) => this.catalog.set(rows ?? []),
      error: () => {},
    });
  }

  itemName(id: string): string {
    return this.itemNames().get(id) ?? id;
  }

  edit(): void {
    void this.router.navigate(['/procurement/suppliers', this.id, 'edit']);
  }

  openCatalogAdd(): void {
    this.catalogForm = {
      item_id: '',
      item_label: '',
      supplier_sku: '',
      supplier_item_name: '',
      pack_qty: '',
      min_order_qty: '',
      lead_time_days: '',
      is_preferred: false,
      is_active: true,
      notes: '',
    };
    this.catalogError.set(null);
    this.catalogModal.set(true);
  }

  openCatalogEdit(row: ProcurementItemSupplier): void {
    this.catalogForm = {
      item_id: row.item_id,
      item_label: this.itemName(row.item_id),
      supplier_sku: row.supplier_sku ?? '',
      supplier_item_name: row.supplier_item_name ?? '',
      pack_qty: row.pack_qty ?? '',
      min_order_qty: row.min_order_qty ?? '',
      lead_time_days: row.lead_time_days != null ? String(row.lead_time_days) : '',
      is_preferred: row.is_preferred,
      is_active: row.is_active,
      notes: row.notes ?? '',
    };
    this.catalogError.set(null);
    this.catalogModal.set(true);
  }

  onItemSelected(item: InventoryItem): void {
    this.catalogForm.item_id = item.id;
    this.catalogForm.item_label = `${item.sku} — ${item.name}`;
  }

  saveCatalog(): void {
    if (this.catalogSaving()) return;
    this.catalogError.set(null);
    if (!this.catalogForm.item_id) return this.catalogError.set('An item is required.');

    const opt = (v: string): string | undefined => v.trim() || undefined;

    const body: ItemSupplierBody = {
      item_id: this.catalogForm.item_id,
      supplier_sku: opt(this.catalogForm.supplier_sku),
      supplier_item_name: opt(this.catalogForm.supplier_item_name),
      pack_qty: dec(this.catalogForm.pack_qty),
      min_order_qty: dec(this.catalogForm.min_order_qty),
      lead_time_days: int(this.catalogForm.lead_time_days),
      is_preferred: this.catalogForm.is_preferred,
      is_active: this.catalogForm.is_active,
      notes: opt(this.catalogForm.notes),
    };
    this.catalogSaving.set(true);
    this.proxy.upsert_catalog(this.id, body).subscribe({
      next: () => {
        this.catalogSaving.set(false);
        this.catalogModal.set(false);
        this.notify.success('Catalog entry saved');
        this.loadCatalog();
      },
      error: (err) => {
        this.catalogSaving.set(false);
        this.catalogError.set(apiErrorInfo(err).message || 'Could not save the entry.');
      },
    });
  }

  async removeCatalog(row: ProcurementItemSupplier): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Remove ${this.itemName(row.item_id)}?`,
      message: 'This drops the supplier-specific pricing for the item.',
      confirmText: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    this.proxy.remove_catalog(this.id, row.item_id).subscribe({
      next: () => {
        this.notify.success('Catalog entry removed');
        this.loadCatalog();
      },
      error: (err) => this.notify.error(apiErrorInfo(err).message || 'Remove failed'),
    });
  }
}
