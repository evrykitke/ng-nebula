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
import { orderLookup } from '../../shared/scm-lookups';
import {
  CreateReceiptRequest,
  InventoryServiceProxy,
  OrderHeader,
  OrderView,
  ProcurementServiceProxy,
  ReceiptLineRequest,
  ReceiptView,
} from '../../../../shared/service-proxies/service-proxies';

interface RecvLine {
  order_line_id: string;
  sku: string;
  item_name: string;
  ordered: string;
  outstanding: string;
  track_batches: boolean;
  track_serials: boolean;
  qty: string;
  rejected_qty: string;
  reject_reason: string;
  batch_no: string;
  serial_nos: string;
  memo: string;
}

/**
 * Book a delivery against a purchase order. The order's outstanding lines
 * are prefilled with what is still due; you adjust the received (and any
 * rejected) quantity, and capture batch/serial detail for tracked items.
 */
@Component({
  selector: 'app-receipt-new-page',
  imports: [FormsModule, RouterLink, UiButton, UiDatepicker, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './receipt-new.page.html',
})
export class ReceiptNewPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly inventory = inject(InventoryServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly canPost = computed(() => this.auth.hasPermission(Permissions.receiptsPost));

  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly order = signal<OrderView | null>(null);

  readonly orderLookup = orderLookup(this.proxy, ['approved', 'partially_received']);
  orderId = '';
  orderLabel = '';

  private trackFlags = new Map<string, { batches: boolean; serials: boolean }>();

  form = {
    receipt_date: DateTime.now() as DateTime | undefined,
    reference: '',
    carrier: '',
    tracking_no: '',
    vehicle_reg: '',
    delivered_by: '',
    memo: '',
  };

  readonly lines = signal<RecvLine[]>([]);

  constructor() {
    this.inventory.list_items(null, null, null).subscribe({
      next: (all) => {
        this.trackFlags = new Map(
          (all ?? []).map((i) => [i.id, { batches: i.track_batches, serials: i.track_serials }]),
        );
        // A preselected order from the query param loads after flags are ready.
        const qpOrder = this.route.snapshot.queryParamMap.get('order');
        if (qpOrder) this.loadOrder(qpOrder);
      },
      error: () => {
        const qpOrder = this.route.snapshot.queryParamMap.get('order');
        if (qpOrder) this.loadOrder(qpOrder);
      },
    });
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
          o.lines
            .map((l) => {
              const outstanding = Math.max(0, num(l.qty) - num(l.received_qty));
              const flags = this.trackFlags.get(l.item_id) ?? { batches: false, serials: false };
              return {
                order_line_id: l.id,
                sku: l.sku,
                item_name: l.item_name,
                ordered: l.qty,
                outstanding: String(outstanding),
                track_batches: flags.batches,
                track_serials: flags.serials,
                qty: outstanding > 0 ? String(outstanding) : '',
                rejected_qty: '',
                reject_reason: '',
                batch_no: '',
                serial_nos: '',
                memo: '',
              } as RecvLine;
            })
            .filter((l) => num(l.outstanding) > 0),
        );
      },
      error: (err) => {
        this.notify.error('Could not load the order', apiErrorInfo(err).message);
      },
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
    const save$ = this.proxy.create_receipt(body);
    const flow$ = post
      ? save$.pipe(switchMap((r: ReceiptView) => this.proxy.post_receipt(r.id)))
      : save$;
    flow$.subscribe({
      next: (r) => {
        this.saving.set(false);
        this.notify.success(post ? 'Receipt posted' : 'Receipt saved');
        void this.router.navigate(['/procurement/receipts', r.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the receipt.');
      },
    });
  }

  private build(): CreateReceiptRequest | null {
    this.formError.set(null);
    if (!this.orderId) {
      this.formError.set('Select a purchase order.');
      return null;
    }
    const date = this.form.receipt_date;
    if (!date || !date.isValid) {
      this.formError.set('A valid receipt date is required.');
      return null;
    }
    const lines: ReceiptLineRequest[] = [];
    for (const l of this.lines()) {
      const qty = num(l.qty);
      const rejected = num(l.rejected_qty);
      if (qty <= 0 && rejected <= 0) continue; // nothing received on this line
      if (l.track_batches && qty > 0 && !l.batch_no.trim()) {
        this.formError.set(`${l.sku} tracks batches — enter a batch number.`);
        return null;
      }
      const serials = l.serial_nos
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (l.track_serials && qty > 0 && serials.length === 0) {
        this.formError.set(`${l.sku} tracks serials — enter the serial numbers.`);
        return null;
      }
      lines.push({
        order_line_id: l.order_line_id,
        qty: qty.toString(),
        rejected_qty: rejected > 0 ? rejected.toString() : undefined,
        reject_reason: rejected > 0 ? l.reject_reason.trim() || undefined : undefined,
        batch_no: l.track_batches ? l.batch_no.trim() : undefined,
        serial_nos: l.track_serials ? serials : undefined,
        memo: l.memo.trim() || undefined,
      });
    }
    if (lines.length === 0) {
      this.formError.set('Enter a received quantity on at least one line.');
      return null;
    }
    return {
      order_id: this.orderId,
      receipt_date: asDateString(date),
      reference: this.form.reference.trim() || undefined,
      carrier: this.form.carrier.trim() || undefined,
      tracking_no: this.form.tracking_no.trim() || undefined,
      vehicle_reg: this.form.vehicle_reg.trim() || undefined,
      delivered_by: this.form.delivered_by.trim() || undefined,
      memo: this.form.memo.trim() || undefined,
      lines,
    };
  }

  readonly fmtQty = fmtQty;
  readonly num = num;
}
