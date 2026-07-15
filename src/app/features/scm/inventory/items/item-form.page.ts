import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiButton } from '../../../../shared/ui/button';
import { Lookup } from '../../../../shared/lookup/lookup';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { itemLookup, supplierLookup, taxCodeLookup, uomLookup, warehouseLookup } from '../../shared/scm-lookups';
import {
  AccountingServiceProxy,
  CostingMethod,
  InventoryCategory,
  InventoryItem,
  InventoryServiceProxy,
  ItemBody,
  ItemType,
  ProcurementServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/**
 * The item master form (create + edit). One long card with grouped
 * sections — an item's fields cluster naturally (identity, units, pricing,
 * planning, tracking) and a full page beats a cramped modal.
 */
@Component({
  selector: 'app-item-form-page',
  imports: [FormsModule, RouterLink, UiButton, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item-form.page.html',
})
export class ItemFormPage {
  private readonly proxy = inject(InventoryServiceProxy);
  private readonly procurement = inject(ProcurementServiceProxy);
  private readonly accounting = inject(AccountingServiceProxy);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly editId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly itemTypes: ItemType[] = ['stockable', 'consumable', 'service'];
  readonly costingMethods: CostingMethod[] = ['moving_average'];

  readonly categories = signal<InventoryCategory[]>([]);

  readonly uomLookup = uomLookup(this.proxy);
  readonly warehouseLookup = warehouseLookup(this.proxy);
  readonly supplierLookup = supplierLookup(this.procurement, (s) => s.is_active);
  readonly purchaseTaxLookup = taxCodeLookup(this.accounting, 'input');
  readonly salesTaxLookup = taxCodeLookup(this.accounting, 'output');

  form = {
    sku: '',
    name: '',
    description: '',
    category_id: '',
    item_type: 'stockable' as ItemType,
    is_active: true,
    is_purchasable: true,
    is_sellable: true,
    // Units & costing
    uom_id: '',
    uom_label: '',
    costing_method: 'moving_average' as CostingMethod,
    standard_cost: '',
    // Purchasing
    purchase_price: '',
    purchase_tax_code_id: '',
    purchase_tax_label: '',
    preferred_supplier_id: '',
    preferred_supplier_label: '',
    lead_time_days: '',
    min_order_qty: '',
    order_multiple: '',
    // Selling
    selling_price: '',
    min_selling_price: '',
    sales_tax_code_id: '',
    sales_tax_label: '',
    // Planning
    default_warehouse_id: '',
    default_warehouse_label: '',
    reorder_level: '',
    reorder_qty: '',
    max_level: '',
    safety_stock: '',
    // Tracking & control
    track_batches: false,
    track_serials: false,
    shelf_life_days: '',
    warranty_days: '',
    allow_negative: false,
    // Identification extras
    barcode: '',
    brand: '',
    model: '',
    manufacturer: '',
    manufacturer_part_no: '',
    hs_code: '',
    country_of_origin: '',
    notes: '',
  };

  readonly title = computed(() => (this.editId() ? 'Edit item' : 'New item'));

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.editId.set(id);

    this.proxy.list_categories().subscribe({
      next: (all) => this.categories.set(all ?? []),
      error: () => {},
    });

    if (id) this.load(id);
  }

  private load(id: string): void {
    this.proxy.get_item(id).subscribe({
      next: (i) => this.prefill(i),
      error: (err) => {
        this.notify.error('Could not load the item', apiErrorInfo(err).message);
        void this.router.navigate(['/inventory/items']);
      },
    });
  }

  private prefill(i: InventoryItem): void {
    this.form = {
      ...this.form,
      sku: i.sku,
      name: i.name,
      description: i.description ?? '',
      category_id: i.category_id ?? '',
      item_type: i.item_type as ItemType,
      is_active: i.is_active,
      is_purchasable: i.is_purchasable,
      is_sellable: i.is_sellable,
      uom_id: i.uom_id,
      costing_method: i.costing_method as CostingMethod,
      standard_cost: i.standard_cost ?? '',
      purchase_price: i.purchase_price ?? '',
      purchase_tax_code_id: i.purchase_tax_code_id ?? '',
      preferred_supplier_id: i.preferred_supplier_id ?? '',
      lead_time_days: i.lead_time_days != null ? String(i.lead_time_days) : '',
      min_order_qty: i.min_order_qty ?? '',
      order_multiple: i.order_multiple ?? '',
      selling_price: i.selling_price ?? '',
      min_selling_price: i.min_selling_price ?? '',
      sales_tax_code_id: i.sales_tax_code_id ?? '',
      default_warehouse_id: i.default_warehouse_id ?? '',
      reorder_level: i.reorder_level ?? '',
      reorder_qty: i.reorder_qty ?? '',
      max_level: i.max_level ?? '',
      safety_stock: i.safety_stock ?? '',
      track_batches: i.track_batches,
      track_serials: i.track_serials,
      shelf_life_days: i.shelf_life_days != null ? String(i.shelf_life_days) : '',
      warranty_days: i.warranty_days != null ? String(i.warranty_days) : '',
      allow_negative: i.allow_negative,
      barcode: i.barcode ?? '',
      brand: i.brand ?? '',
      model: i.model ?? '',
      manufacturer: i.manufacturer ?? '',
      manufacturer_part_no: i.manufacturer_part_no ?? '',
      hs_code: i.hs_code ?? '',
      country_of_origin: i.country_of_origin ?? '',
      notes: i.notes ?? '',
    };
    // Resolve the lookup display labels asynchronously.
    this.resolveLabels(i);
  }

  private resolveLabels(i: InventoryItem): void {
    this.proxy.list_uoms().subscribe({
      next: (uoms) => {
        const u = (uoms ?? []).find((x) => x.id === i.uom_id);
        if (u) this.form.uom_label = `${u.code} — ${u.name}`;
      },
      error: () => {},
    });
    if (i.default_warehouse_id) {
      this.proxy.list_warehouses().subscribe({
        next: (whs) => {
          const w = (whs ?? []).find((x) => x.id === i.default_warehouse_id);
          if (w) this.form.default_warehouse_label = `${w.code} — ${w.name}`;
        },
        error: () => {},
      });
    }
    if (i.preferred_supplier_id) {
      this.procurement.list_suppliers().subscribe({
        next: (sups) => {
          const s = (sups ?? []).find((x) => x.id === i.preferred_supplier_id);
          if (s) this.form.preferred_supplier_label = `${s.code} — ${s.name}`;
        },
        error: () => {},
      });
    }
    if (i.purchase_tax_code_id || i.sales_tax_code_id) {
      this.accounting.list_tax_codes().subscribe({
        next: (codes) => {
          const p = (codes ?? []).find((x) => x.id === i.purchase_tax_code_id);
          if (p) this.form.purchase_tax_label = `${p.code} (${Number(p.rate)}%)`;
          const s = (codes ?? []).find((x) => x.id === i.sales_tax_code_id);
          if (s) this.form.sales_tax_label = `${s.code} (${Number(s.rate)}%)`;
        },
        error: () => {},
      });
    }
  }

  save(): void {
    if (this.saving()) return;
    this.formError.set(null);
    if (!this.form.sku.trim()) return this.formError.set('SKU is required.');
    if (!this.form.name.trim()) return this.formError.set('Name is required.');
    if (!this.form.uom_id) return this.formError.set('A stock unit of measure is required.');

    const dec = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());
    const int = (v: string): number | undefined => (v.trim() === '' ? undefined : Number(v));

    const body: ItemBody = {
      sku: this.form.sku.trim(),
      name: this.form.name.trim(),
      description: this.form.description.trim() || undefined,
      category_id: this.form.category_id || undefined,
      item_type: this.form.item_type,
      is_active: this.form.is_active,
      is_purchasable: this.form.is_purchasable,
      is_sellable: this.form.is_sellable,
      uom_id: this.form.uom_id,
      costing_method: this.form.costing_method,
      standard_cost: dec(this.form.standard_cost),
      purchase_price: dec(this.form.purchase_price),
      purchase_tax_code_id: this.form.purchase_tax_code_id || undefined,
      preferred_supplier_id: this.form.preferred_supplier_id || undefined,
      lead_time_days: int(this.form.lead_time_days),
      min_order_qty: dec(this.form.min_order_qty),
      order_multiple: dec(this.form.order_multiple),
      selling_price: dec(this.form.selling_price),
      min_selling_price: dec(this.form.min_selling_price),
      sales_tax_code_id: this.form.sales_tax_code_id || undefined,
      default_warehouse_id: this.form.default_warehouse_id || undefined,
      reorder_level: dec(this.form.reorder_level),
      reorder_qty: dec(this.form.reorder_qty),
      max_level: dec(this.form.max_level),
      safety_stock: dec(this.form.safety_stock),
      track_batches: this.form.track_batches,
      track_serials: this.form.track_serials,
      shelf_life_days: int(this.form.shelf_life_days),
      warranty_days: int(this.form.warranty_days),
      allow_negative: this.form.allow_negative,
      barcode: this.form.barcode.trim() || undefined,
      brand: this.form.brand.trim() || undefined,
      model: this.form.model.trim() || undefined,
      manufacturer: this.form.manufacturer.trim() || undefined,
      manufacturer_part_no: this.form.manufacturer_part_no.trim() || undefined,
      hs_code: this.form.hs_code.trim() || undefined,
      country_of_origin: this.form.country_of_origin.trim() || undefined,
      notes: this.form.notes.trim() || undefined,
    };

    this.saving.set(true);
    const editId = this.editId();
    const save$ = editId ? this.proxy.update_item(editId, body) : this.proxy.create_item(body);
    save$.subscribe({
      next: (item) => {
        this.saving.set(false);
        this.notify.success(editId ? 'Item updated' : 'Item created');
        void this.router.navigate(['/inventory/items', item.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the item.');
      },
    });
  }
}
