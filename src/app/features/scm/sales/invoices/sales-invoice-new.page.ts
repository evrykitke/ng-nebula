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
import { asDateString, fmtMoney, fmtQty, num } from '../../shared/scm-format';
import { salesOrderLookup } from '../../shared/scm-lookups';
import {
  CreateSalesInvoiceRequest,
  SalesInvoiceLineRequest,
  SalesInvoiceView,
  SalesOrderHeader,
  SalesOrderView,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

interface BillLine {
  order_line_id: string;
  sku: string;
  item_name: string;
  ordered: string;
  delivered: string;
  billed: string;
  qty: string;
  unit_price: string;
  discount_pct: string;
}

/**
 * Raise a customer invoice against a sales order. Lines prefill with the
 * delivered-not-yet-billed quantity at the order price.
 */
@Component({
  selector: 'app-sales-invoice-new-page',
  imports: [FormsModule, RouterLink, UiButton, UiDatepicker, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-invoice-new.page.html',
})
export class SalesInvoiceNewPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly canPost = computed(() => this.auth.hasPermission(Permissions.salesInvoicesPost));

  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly order = signal<SalesOrderView | null>(null);

  readonly orderLookup = salesOrderLookup(this.proxy, [
    'confirmed',
    'partially_delivered',
    'delivered',
  ]);
  orderId = '';
  orderLabel = '';

  form = {
    invoice_date: DateTime.now() as DateTime | undefined,
    due_date: undefined as DateTime | undefined,
    customer_po_no: '',
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

  onOrderSelected(o: SalesOrderHeader): void {
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
    this.proxy.get_order2(id).subscribe({
      next: (o) => {
        this.orderId = o.id;
        this.orderLabel = `${o.number ?? '(draft)'} — ${o.customer_name}`;
        this.order.set(o);
        if (!this.form.customer_po_no) this.form.customer_po_no = o.customer_po_no ?? '';
        this.lines.set(
          o.lines.map((l) => {
            const toBill = Math.max(0, num(l.delivered_qty) - num(l.billed_qty));
            return {
              order_line_id: l.id,
              sku: l.sku,
              item_name: l.item_name,
              ordered: l.qty,
              delivered: l.delivered_qty,
              billed: l.billed_qty,
              qty: toBill > 0 ? String(toBill) : '',
              unit_price: String(num(l.effective_price)),
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
    const save$ = this.proxy.create_invoice2(body);
    const flow$ = post
      ? save$.pipe(switchMap((i: SalesInvoiceView) => this.proxy.post_invoice2(i.id)))
      : save$;
    flow$.subscribe({
      next: (i) => {
        this.saving.set(false);
        this.notify.success(post ? 'Invoice posted' : 'Invoice saved');
        void this.router.navigate(['/sales/invoices', i.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the invoice.');
      },
    });
  }

  private build(): CreateSalesInvoiceRequest | null {
    this.formError.set(null);
    const o = this.order();
    if (!o) {
      this.formError.set('Select a sales order.');
      return null;
    }
    const date = this.form.invoice_date;
    if (!date || !date.isValid) {
      this.formError.set('A valid invoice date is required.');
      return null;
    }
    const lines: SalesInvoiceLineRequest[] = [];
    for (const l of this.lines()) {
      const qty = num(l.qty);
      if (qty <= 0) continue;
      const price = num(l.unit_price);
      if (!(price >= 0) || l.unit_price.trim() === '') {
        this.formError.set(`Enter a unit price for ${l.sku}.`);
        return null;
      }
      lines.push({
        order_line_id: l.order_line_id,
        qty: qty.toString(),
        unit_price: price.toString(),
        discount_pct: l.discount_pct.trim() ? Number(l.discount_pct).toString() : undefined,
      });
    }
    if (lines.length === 0) {
      this.formError.set('Enter a billed quantity on at least one line.');
      return null;
    }
    return {
      order_id: o.id,
      invoice_date: asDateString(date),
      due_date: this.form.due_date ? asDateString(this.form.due_date) : undefined,
      customer_po_no: this.form.customer_po_no.trim() || undefined,
      discount_pct: this.form.discount_pct.trim() ? Number(this.form.discount_pct).toString() : undefined,
      other_charges: this.form.other_charges.trim() ? Number(this.form.other_charges).toString() : undefined,
      memo: this.form.memo.trim() || undefined,
      lines,
    };
  }

  overBilled(l: BillLine): boolean {
    return num(l.qty) + num(l.billed) > num(l.delivered) + 0.0001;
  }

  readonly fmtQty = fmtQty;
  readonly fmtMoney = fmtMoney;
  readonly num = num;
}
