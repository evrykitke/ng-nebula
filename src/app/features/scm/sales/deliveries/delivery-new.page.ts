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
import { asDateString, fmtQty, num } from '../../shared/scm-format';
import { salesOrderLookup } from '../../shared/scm-lookups';
import {
  CreateDeliveryRequest,
  DeliveryLineRequest,
  DeliveryView,
  SalesOrderHeader,
  SalesOrderView,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

interface ShipLine {
  order_line_id: string;
  sku: string;
  item_name: string;
  ordered: string;
  delivered: string;
  qty: string;
  batch_no: string;
  serial_nos: string;
}

/**
 * Issue a delivery against a sales order. Lines prefill with the
 * not-yet-delivered quantity; batches and serials can be captured per line.
 */
@Component({
  selector: 'app-delivery-new-page',
  imports: [FormsModule, RouterLink, UiButton, UiDatepicker, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delivery-new.page.html',
})
export class DeliveryNewPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly canPost = computed(() => this.auth.hasPermission(Permissions.deliveriesPost));

  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly order = signal<SalesOrderView | null>(null);

  readonly orderLookup = salesOrderLookup(this.proxy, ['confirmed', 'partially_delivered']);
  orderId = '';
  orderLabel = '';

  form = {
    delivery_date: DateTime.now() as DateTime | undefined,
    carrier: '',
    driver_name: '',
    vehicle_reg: '',
    tracking_no: '',
    received_by_name: '',
    shipping_address: '',
    memo: '',
  };

  readonly lines = signal<ShipLine[]>([]);

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
        if (!this.form.shipping_address) this.form.shipping_address = o.shipping_address ?? '';
        this.lines.set(
          o.lines.map((l) => {
            const remaining = Math.max(0, num(l.qty) - num(l.delivered_qty));
            return {
              order_line_id: l.id,
              sku: l.sku,
              item_name: l.item_name,
              ordered: l.qty,
              delivered: l.delivered_qty,
              qty: remaining > 0 ? String(remaining) : '',
              batch_no: '',
              serial_nos: '',
            } as ShipLine;
          }),
        );
      },
      error: (err) => this.notify.error('Could not load the order', apiErrorInfo(err).message),
    });
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
    const save$ = this.proxy.create_delivery(body);
    const flow$ = post
      ? save$.pipe(switchMap((d: DeliveryView) => this.proxy.post_delivery(d.id)))
      : save$;
    flow$.subscribe({
      next: (d) => {
        this.saving.set(false);
        this.notify.success(post ? 'Delivery posted' : 'Delivery saved');
        void this.router.navigate(['/sales/deliveries', d.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the delivery.');
      },
    });
  }

  private build(): CreateDeliveryRequest | null {
    this.formError.set(null);
    const o = this.order();
    if (!o) {
      this.formError.set('Select a sales order.');
      return null;
    }
    const date = this.form.delivery_date;
    if (!date || !date.isValid) {
      this.formError.set('A valid delivery date is required.');
      return null;
    }
    const lines: DeliveryLineRequest[] = [];
    for (const l of this.lines()) {
      const qty = num(l.qty);
      if (qty <= 0) continue;
      const serials = l.serial_nos
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      lines.push({
        order_line_id: l.order_line_id,
        qty: qty.toString(),
        batch_no: l.batch_no.trim() || undefined,
        serial_nos: serials.length ? serials : undefined,
      });
    }
    if (lines.length === 0) {
      this.formError.set('Enter a quantity on at least one line.');
      return null;
    }
    return {
      order_id: o.id,
      delivery_date: asDateString(date),
      carrier: this.form.carrier.trim() || undefined,
      driver_name: this.form.driver_name.trim() || undefined,
      vehicle_reg: this.form.vehicle_reg.trim() || undefined,
      tracking_no: this.form.tracking_no.trim() || undefined,
      received_by_name: this.form.received_by_name.trim() || undefined,
      shipping_address: this.form.shipping_address.trim() || undefined,
      memo: this.form.memo.trim() || undefined,
      lines,
    };
  }

  overDeliver(l: ShipLine): boolean {
    return num(l.qty) + num(l.delivered) > num(l.ordered) + 0.0001;
  }

  readonly fmtQty = fmtQty;
  readonly num = num;
}
