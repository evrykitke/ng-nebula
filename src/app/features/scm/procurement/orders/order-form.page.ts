import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { DateTime } from 'luxon';
import { switchMap } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button';
import { UiDatepicker } from '../../../../shared/ui/datepicker';
import { Lookup } from '../../../../shared/lookup/lookup';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { asDate } from '../../../../shared/forms/dates';
import { fieldText, optDec, optInt } from '../../../../shared/forms/numeric';
import { asDateString, fmtMoney, num } from '../../shared/scm-format';
import { itemLookup, supplierLookup, taxCodeLookup, warehouseLookup } from '../../shared/scm-lookups';
import {
  AccountingServiceProxy,
  CreateOrderRequest,
  InventoryItem,
  InventoryServiceProxy,
  OrderLineRequest,
  OrderView,
  ProcurementServiceProxy,
  ProcurementSupplier,
} from '../../../../shared/service-proxies/service-proxies';

interface OrderLine {
  item_id: string;
  item_label: string;
  description: string;
  qty: string;
  unit_price: string;
  discount_pct: string;
  tax_code_id: string;
  tax_label: string;
}

/**
 * Compose or edit a draft purchase order and optionally submit it. Selecting
 * a supplier defaults the currency, payment terms and tax code. The order
 * total previews live from the lines and header adjustments.
 */
@Component({
  selector: 'app-order-form-page',
  imports: [FormsModule, RouterLink, NgIcon, UiButton, UiDatepicker, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-form.page.html',
})
export class OrderFormPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly inventory = inject(InventoryServiceProxy);
  private readonly accounting = inject(AccountingServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly canSubmit = computed(() => this.auth.hasPermission(Permissions.ordersSubmit));

  readonly editId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly supplierLookup = supplierLookup(this.proxy, (s) => s.is_active && !s.on_hold);
  readonly warehouseLookup = warehouseLookup(this.inventory);
  readonly itemLookup = itemLookup(this.inventory, (i) => i.is_purchasable);
  readonly taxLookup = taxCodeLookup(this.accounting, 'input');

  form = {
    supplier_id: '',
    supplier_label: '',
    warehouse_id: '',
    warehouse_label: '',
    currency: '',
    order_date: DateTime.now() as DateTime | undefined,
    expected_date: undefined as DateTime | undefined,
    payment_terms_days: '',
    reference: '',
    incoterms: '',
    discount_pct: '',
    other_charges: '',
    tax_inclusive: false,
    memo: '',
  };

  readonly lines = signal<OrderLine[]>([this.blank()]);

  readonly title = computed(() => (this.editId() ? 'Edit purchase order' : 'New purchase order'));

  /** Live subtotal from the lines; header discount and charges applied after. */
  readonly totals = computed(() => {
    let subtotal = 0;
    for (const l of this.lines()) {
      const qty = num(l.qty);
      const price = num(l.unit_price);
      const disc = num(l.discount_pct);
      subtotal += qty * price * (1 - disc / 100);
    }
    const headerDisc = num(this.form.discount_pct);
    const afterDisc = subtotal * (1 - headerDisc / 100);
    const total = afterDisc + num(this.form.other_charges);
    return { subtotal, total };
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.editId.set(id);
    if (id) this.loadDraft(id);
  }

  private loadDraft(id: string): void {
    this.proxy.get_order(id).subscribe({
      next: (o: OrderView) => {
        if (o.status !== 'draft') {
          this.notify.error('Only a draft can be edited');
          void this.router.navigate(['/procurement/orders', id]);
          return;
        }
        this.form = {
          supplier_id: o.supplier_id,
          supplier_label: o.supplier_name,
          warehouse_id: o.deliver_to_warehouse_id,
          warehouse_label: o.warehouse_code,
          currency: o.currency,
          order_date: asDate(o.order_date),
          expected_date: asDate(o.expected_date),
          payment_terms_days: String(o.payment_terms_days),
          reference: o.reference ?? '',
          incoterms: o.incoterms ?? '',
          discount_pct: o.discount_pct ?? '',
          other_charges: o.other_charges ?? '',
          tax_inclusive: o.tax_inclusive,
          memo: o.memo ?? '',
        };
        this.lines.set(
          o.lines.map((l) => ({
            item_id: l.item_id,
            item_label: `${l.sku} — ${l.item_name}`,
            description: l.description ?? '',
            qty: String(num(l.qty)),
            unit_price: String(num(l.unit_price)),
            discount_pct: l.discount_pct ?? '',
            tax_code_id: '',
            tax_label: '',
          })),
        );
      },
      error: (err) => {
        this.notify.error('Could not load the draft', apiErrorInfo(err).message);
        void this.router.navigate(['/procurement/orders']);
      },
    });
  }

  private blank(): OrderLine {
    return {
      item_id: '',
      item_label: '',
      description: '',
      qty: '',
      unit_price: '',
      discount_pct: '',
      tax_code_id: '',
      tax_label: '',
    };
  }

  addLine(): void {
    this.lines.update((ls) => [...ls, this.blank()]);
  }

  removeLine(i: number): void {
    this.lines.update((ls) => ls.filter((_, idx) => idx !== i));
  }

  onSupplierSelected(s: ProcurementSupplier): void {
    this.form.supplier_id = s.id;
    this.form.supplier_label = `${s.code} — ${s.name}`;
    if (!this.form.currency) this.form.currency = s.currency;
    if (!this.form.payment_terms_days) this.form.payment_terms_days = String(s.payment_terms_days);
  }

  onItemSelected(line: OrderLine, item: InventoryItem): void {
    line.item_id = item.id;
    line.item_label = `${item.sku} — ${item.name}`;
    if (!line.description) line.description = item.name;
    if (!line.unit_price && item.purchase_price) line.unit_price = String(num(item.purchase_price));
    this.lines.update((ls) => [...ls]);
  }

  onItemValue(line: OrderLine, value: string | null): void {
    line.item_id = value ?? '';
    if (!value) line.item_label = '';
    this.lines.update((ls) => [...ls]);
  }

  recompute(): void {
    this.lines.update((ls) => [...ls]);
  }

  saveDraft(): void {
    this.submit(false);
  }

  saveSubmit(): void {
    this.submit(true);
  }

  private submit(send: boolean): void {
    if (this.saving()) return;
    const body = this.build();
    if (!body) return;

    this.saving.set(true);
    const editId = this.editId();
    const save$ = editId ? this.proxy.update_order(editId, body) : this.proxy.create_order(body);
    const flow$ = send
      ? save$.pipe(switchMap((o: OrderView) => this.proxy.submit_order(o.id)))
      : save$;
    flow$.subscribe({
      next: (o) => {
        this.saving.set(false);
        this.notify.success(send ? 'Order submitted' : 'Draft saved');
        void this.router.navigate(['/procurement/orders', o.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the order.');
      },
    });
  }

  private build(): CreateOrderRequest | null {
    this.formError.set(null);
    if (!this.form.supplier_id) {
      this.formError.set('A supplier is required.');
      return null;
    }
    if (!this.form.warehouse_id) {
      this.formError.set('A delivery warehouse is required.');
      return null;
    }
    const orderDate = this.form.order_date;
    if (!orderDate || !orderDate.isValid) {
      this.formError.set('A valid order date is required.');
      return null;
    }
    const lines: OrderLineRequest[] = [];
    for (const l of this.lines()) {
      if (!l.item_id && !l.qty) continue;
      if (!l.item_id) {
        this.formError.set('Every line needs an item.');
        return null;
      }
      const qty = Number(l.qty);
      const price = Number(l.unit_price);
      if (!(qty > 0)) {
        this.formError.set('Each line needs a positive quantity.');
        return null;
      }
      if (!(price >= 0) || fieldText(l.unit_price) === '') {
        this.formError.set('Each line needs a unit price.');
        return null;
      }
      lines.push({
        item_id: l.item_id,
        description: l.description.trim() || undefined,
        qty: qty.toString(),
        unit_price: price.toString(),
        discount_pct: optDec(l.discount_pct),
        tax_code_id: l.tax_code_id || undefined,
      });
    }
    if (lines.length === 0) {
      this.formError.set('Add at least one line.');
      return null;
    }
    return {
      supplier_id: this.form.supplier_id,
      deliver_to_warehouse_id: this.form.warehouse_id,
      currency: this.form.currency.trim().toUpperCase() || undefined,
      order_date: asDateString(orderDate),
      expected_date: this.form.expected_date ? asDateString(this.form.expected_date) : undefined,
      payment_terms_days: optInt(this.form.payment_terms_days),
      reference: this.form.reference.trim() || undefined,
      incoterms: this.form.incoterms.trim() || undefined,
      discount_pct: optDec(this.form.discount_pct),
      other_charges: optDec(this.form.other_charges),
      tax_inclusive: this.form.tax_inclusive,
      memo: this.form.memo.trim() || undefined,
      lines,
    };
  }

  readonly fmtMoney = fmtMoney;
  readonly num = num;
}
