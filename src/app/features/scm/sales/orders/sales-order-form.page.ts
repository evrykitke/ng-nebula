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
import { optDec, optInt } from '../../../../shared/forms/numeric';
import { asDateString, fmtMoney, num } from '../../shared/scm-format';
import { customerLookup, itemLookup, taxCodeLookup, warehouseLookup } from '../../shared/scm-lookups';
import {
  AccountingServiceProxy,
  CreateSalesOrderRequest,
  InventoryItem,
  InventoryServiceProxy,
  SalesCustomer,
  SalesOrderLineRequest,
  SalesOrderView,
  SalesServiceProxy,
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
 * Compose or edit a draft sales order and optionally confirm it. Selecting a
 * customer defaults the currency, terms and fulfilment warehouse; blank line
 * prices resolve from the customer's price list on the server.
 */
@Component({
  selector: 'app-sales-order-form-page',
  imports: [FormsModule, RouterLink, NgIcon, UiButton, UiDatepicker, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-order-form.page.html',
})
export class SalesOrderFormPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly inventory = inject(InventoryServiceProxy);
  private readonly accounting = inject(AccountingServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly canConfirm = computed(() => this.auth.hasPermission(Permissions.salesOrdersConfirm));

  readonly editId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly customerLookup = customerLookup(this.proxy, (c) => c.is_active && !c.on_hold);
  readonly warehouseLookup = warehouseLookup(this.inventory);
  readonly itemLookup = itemLookup(this.inventory, (i) => i.is_sellable);
  readonly taxLookup = taxCodeLookup(this.accounting, 'output');

  form = {
    customer_id: '',
    customer_label: '',
    customer_contact: '',
    warehouse_id: '',
    warehouse_label: '',
    currency: '',
    order_date: DateTime.now() as DateTime | undefined,
    expected_date: undefined as DateTime | undefined,
    payment_terms_days: '',
    customer_po_no: '',
    shipping_method: '',
    shipping_address: '',
    incoterms: '',
    discount_pct: '',
    other_charges: '',
    tax_inclusive: false,
    terms_and_conditions: '',
    memo: '',
  };

  readonly lines = signal<OrderLine[]>([this.blank()]);

  readonly title = computed(() => (this.editId() ? 'Edit sales order' : 'New sales order'));

  readonly totals = computed(() => {
    let subtotal = 0;
    for (const l of this.lines()) {
      subtotal += num(l.qty) * num(l.unit_price) * (1 - num(l.discount_pct) / 100);
    }
    const afterDisc = subtotal * (1 - num(this.form.discount_pct) / 100);
    return { subtotal, total: afterDisc + num(this.form.other_charges) };
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.editId.set(id);
    if (id) this.loadDraft(id);
  }

  private loadDraft(id: string): void {
    this.proxy.get_order2(id).subscribe({
      next: (o: SalesOrderView) => {
        if (o.status !== 'draft') {
          this.notify.error('Only a draft can be edited');
          void this.router.navigate(['/sales/orders', id]);
          return;
        }
        this.form = {
          customer_id: o.customer_id,
          customer_label: o.customer_name,
          customer_contact: o.customer_contact ?? '',
          warehouse_id: o.warehouse_id,
          warehouse_label: o.warehouse_code,
          currency: o.currency,
          order_date: asDate(o.order_date),
          expected_date: asDate(o.expected_date),
          payment_terms_days: String(o.payment_terms_days),
          customer_po_no: o.customer_po_no ?? '',
          shipping_method: o.shipping_method ?? '',
          shipping_address: o.shipping_address ?? '',
          incoterms: o.incoterms ?? '',
          discount_pct: o.discount_pct ?? '',
          other_charges: o.other_charges ?? '',
          tax_inclusive: o.tax_inclusive,
          terms_and_conditions: o.terms_and_conditions ?? '',
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
        void this.router.navigate(['/sales/orders']);
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

  onCustomerSelected(c: SalesCustomer): void {
    this.form.customer_id = c.id;
    this.form.customer_label = `${c.code} — ${c.name}`;
    if (!this.form.currency) this.form.currency = c.currency;
    if (!this.form.payment_terms_days) this.form.payment_terms_days = String(c.payment_terms_days);
    if (!this.form.customer_contact) this.form.customer_contact = c.contact_name ?? '';
    if (!this.form.warehouse_id && c.default_warehouse_id) {
      this.form.warehouse_id = c.default_warehouse_id;
      this.inventory.list_warehouses().subscribe({
        next: (whs) => {
          const w = (whs ?? []).find((x) => x.id === c.default_warehouse_id);
          if (w) this.form.warehouse_label = `${w.code} — ${w.name}`;
        },
        error: () => {},
      });
    }
  }

  onItemSelected(line: OrderLine, item: InventoryItem): void {
    line.item_id = item.id;
    line.item_label = `${item.sku} — ${item.name}`;
    if (!line.description) line.description = item.name;
    if (!line.unit_price && item.selling_price) line.unit_price = String(num(item.selling_price));
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

  saveConfirm(): void {
    this.submit(true);
  }

  private submit(confirm: boolean): void {
    if (this.saving()) return;
    const body = this.build();
    if (!body) return;

    this.saving.set(true);
    const editId = this.editId();
    const save$ = editId
      ? this.proxy.update_order2(editId, body)
      : this.proxy.create_order2(body);
    const flow$ = confirm
      ? save$.pipe(switchMap((o: SalesOrderView) => this.proxy.confirm_order(o.id, {})))
      : save$;
    flow$.subscribe({
      next: (o) => {
        this.saving.set(false);
        this.notify.success(confirm ? 'Order confirmed' : 'Draft saved');
        void this.router.navigate(['/sales/orders', o.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the order.');
      },
    });
  }

  private build(): CreateSalesOrderRequest | null {
    this.formError.set(null);
    if (!this.form.customer_id) {
      this.formError.set('A customer is required.');
      return null;
    }
    if (!this.form.warehouse_id) {
      this.formError.set('A fulfilment warehouse is required.');
      return null;
    }
    const orderDate = this.form.order_date;
    if (!orderDate || !orderDate.isValid) {
      this.formError.set('A valid order date is required.');
      return null;
    }
    const lines: SalesOrderLineRequest[] = [];
    for (const l of this.lines()) {
      if (!l.item_id && !l.qty) continue;
      if (!l.item_id) {
        this.formError.set('Every line needs an item.');
        return null;
      }
      const qty = Number(l.qty);
      if (!(qty > 0)) {
        this.formError.set('Each line needs a positive quantity.');
        return null;
      }
      lines.push({
        item_id: l.item_id,
        description: l.description.trim() || undefined,
        qty: qty.toString(),
        unit_price: optDec(l.unit_price),
        discount_pct: optDec(l.discount_pct),
        tax_code_id: l.tax_code_id || undefined,
      });
    }
    if (lines.length === 0) {
      this.formError.set('Add at least one line.');
      return null;
    }
    return {
      customer_id: this.form.customer_id,
      customer_contact: this.form.customer_contact.trim() || undefined,
      warehouse_id: this.form.warehouse_id,
      currency: this.form.currency.trim().toUpperCase() || undefined,
      order_date: asDateString(orderDate),
      expected_date: this.form.expected_date ? asDateString(this.form.expected_date) : undefined,
      payment_terms_days: optInt(this.form.payment_terms_days),
      customer_po_no: this.form.customer_po_no.trim() || undefined,
      shipping_method: this.form.shipping_method.trim() || undefined,
      shipping_address: this.form.shipping_address.trim() || undefined,
      incoterms: this.form.incoterms.trim() || undefined,
      discount_pct: optDec(this.form.discount_pct),
      other_charges: optDec(this.form.other_charges),
      tax_inclusive: this.form.tax_inclusive,
      terms_and_conditions: this.form.terms_and_conditions.trim() || undefined,
      memo: this.form.memo.trim() || undefined,
      lines,
    };
  }

  readonly fmtMoney = fmtMoney;
  readonly num = num;
}
