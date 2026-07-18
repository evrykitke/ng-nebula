import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { fieldText, optDec } from '../../../../shared/forms/numeric';
import { asDateString, fmtMoney, fmtQty, num } from '../../shared/scm-format';
import { orderLookup } from '../../shared/scm-lookups';
import {
  CreateInvoiceRequest,
  InvoiceLineRequest,
  InvoiceView,
  OrderHeader,
  OrderView,
  ProcurementServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

interface BillLine {
  order_line_id: string;
  sku: string;
  item_name: string;
  ordered: string;
  received: string;
  billed: string;
  qty: string;
  unit_price: string;
  discount_pct: string;
}

/**
 * Raise a supplier bill against a purchase order. Lines prefill with the
 * received-not-yet-billed quantity at the PO price — the 3-way match between
 * ordered, received and billed is shown per line so over-billing is obvious.
 */
@Component({
  selector: 'app-invoice-new-page',
  imports: [FormsModule, RouterLink, UiButton, UiDatepicker, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-new.page.html',
})
export class InvoiceNewPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly canPost = computed(() => this.auth.hasPermission(Permissions.purchaseInvoicesPost));

  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly order = signal<OrderView | null>(null);

  readonly orderLookup = orderLookup(this.proxy, [
    'partially_received',
    'received',
    'closed',
    'approved',
  ]);
  orderId = '';
  orderLabel = '';

  form = {
    supplier_invoice_no: '',
    invoice_date: DateTime.now() as DateTime | undefined,
    due_date: undefined as DateTime | undefined,
    discount_pct: '',
    other_charges: '',
    memo: '',
  };

  readonly lines = signal<BillLine[]>([]);

  readonly total = computed(() => {
    let subtotal = 0;
    for (const l of this.lines()) {
      subtotal += num(l.qty) * num(l.unit_price) * (1 - num(l.discount_pct) / 100);
    }
    const afterDisc = subtotal * (1 - num(this.form.discount_pct) / 100);
    return afterDisc + num(this.form.other_charges);
  });

  constructor() {
    const qpOrder = this.route.snapshot.queryParamMap.get('order');
    if (qpOrder) this.loadOrder(qpOrder);
  }

  onOrderSelected(o: OrderHeader): void {
    this.orderId = o.id;
    this.orderLabel = `${o.number ?? '(draft)'} — ${o.supplier_name}`;
    this.loadOrder(o.id);
  }

  onOrderCleared(value: string | null): void {
    if (!value) {
      this.orderId = '';
      this.orderLabel = '';
      this.order.set(null);
      this.lines.set([]);
    }
  }

  private loadOrder(id: string): void {
    this.proxy.get_order(id).subscribe({
      next: (o) => {
        this.orderId = o.id;
        this.orderLabel = `${o.number ?? '(draft)'} — ${o.supplier_name}`;
        this.order.set(o);
        this.lines.set(
          o.lines.map((l) => {
            const toBill = Math.max(0, num(l.received_qty) - num(l.billed_qty));
            return {
              order_line_id: l.id,
              sku: l.sku,
              item_name: l.item_name,
              ordered: l.qty,
              received: l.received_qty,
              billed: l.billed_qty,
              qty: toBill > 0 ? String(toBill) : '',
              unit_price: String(num(l.unit_price)),
              discount_pct: l.discount_pct ?? '',
            } as BillLine;
          }),
        );
      },
      error: (err) => this.notify.error('Could not load the order', apiErrorInfo(err).message),
    });
  }

  recompute(): void {
    this.lines.update((ls) => [...ls]);
  }

  saveDraft(): void {
    this.submit(false);
  }

  savePost(): void {
    this.submit(true);
  }

  private submit(post: boolean): void {
    if (this.saving()) return;
    const body = this.build();
    if (!body) return;

    this.saving.set(true);
    const save$ = this.proxy.create_invoice(body);
    const flow$ = post
      ? save$.pipe(switchMap((i: InvoiceView) => this.proxy.post_invoice(i.id)))
      : save$;
    flow$.subscribe({
      next: (i) => {
        this.saving.set(false);
        this.notify.success(post ? 'Invoice posted' : 'Invoice saved');
        void this.router.navigate(['/procurement/invoices', i.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the invoice.');
      },
    });
  }

  private build(): CreateInvoiceRequest | null {
    this.formError.set(null);
    const o = this.order();
    if (!o) {
      this.formError.set('Select a purchase order.');
      return null;
    }
    if (!this.form.supplier_invoice_no.trim()) {
      this.formError.set("Enter the supplier's invoice number.");
      return null;
    }
    const date = this.form.invoice_date;
    if (!date || !date.isValid) {
      this.formError.set('A valid invoice date is required.');
      return null;
    }
    const lines: InvoiceLineRequest[] = [];
    for (const l of this.lines()) {
      const qty = num(l.qty);
      if (qty <= 0) continue;
      const price = num(l.unit_price);
      if (!(price >= 0) || fieldText(l.unit_price) === '') {
        this.formError.set(`Enter a unit price for ${l.sku}.`);
        return null;
      }
      lines.push({
        order_line_id: l.order_line_id,
        qty: qty.toString(),
        unit_price: price.toString(),
        discount_pct: optDec(l.discount_pct),
      });
    }
    if (lines.length === 0) {
      this.formError.set('Enter a billed quantity on at least one line.');
      return null;
    }
    return {
      order_id: o.id,
      supplier_id: o.supplier_id,
      supplier_invoice_no: this.form.supplier_invoice_no.trim(),
      invoice_date: asDateString(date),
      due_date: this.form.due_date ? asDateString(this.form.due_date) : undefined,
      discount_pct: optDec(this.form.discount_pct),
      other_charges: optDec(this.form.other_charges),
      memo: this.form.memo.trim() || undefined,
      lines,
    };
  }

  overBilled(l: BillLine): boolean {
    return num(l.qty) + num(l.billed) > num(l.received) + 0.0001;
  }

  readonly fmtQty = fmtQty;
  readonly fmtMoney = fmtMoney;
  readonly num = num;
}
