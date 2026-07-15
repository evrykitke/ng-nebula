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
  CreateReturnRequest,
  InventoryServiceProxy,
  OrderHeader,
  OrderView,
  ProcurementServiceProxy,
  ReturnLineRequest,
  ReturnView,
} from '../../../../shared/service-proxies/service-proxies';

interface RetLine {
  order_line_id: string;
  sku: string;
  item_name: string;
  received: string;
  track_batches: boolean;
  track_serials: boolean;
  qty: string;
  batch_no: string;
  serial_nos: string;
  reason: string;
}

/** Return received goods to a supplier against a purchase order. */
@Component({
  selector: 'app-return-new-page',
  imports: [FormsModule, RouterLink, UiButton, UiDatepicker, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './return-new.page.html',
})
export class ReturnNewPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly inventory = inject(InventoryServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly canPost = computed(() => this.auth.hasPermission(Permissions.returnsPost));

  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly order = signal<OrderView | null>(null);

  readonly orderLookup = orderLookup(this.proxy, [
    'partially_received',
    'received',
    'closed',
  ]);
  orderId = '';
  orderLabel = '';

  private trackFlags = new Map<string, { batches: boolean; serials: boolean }>();

  form = {
    return_date: DateTime.now() as DateTime | undefined,
    reason: '',
    reference: '',
    carrier: '',
    memo: '',
  };

  readonly lines = signal<RetLine[]>([]);

  constructor() {
    this.inventory.list_items(null, null, null).subscribe({
      next: (all) => {
        this.trackFlags = new Map(
          (all ?? []).map((i) => [i.id, { batches: i.track_batches, serials: i.track_serials }]),
        );
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
            .filter((l) => num(l.received_qty) > 0)
            .map((l) => {
              const flags = this.trackFlags.get(l.item_id) ?? { batches: false, serials: false };
              return {
                order_line_id: l.id,
                sku: l.sku,
                item_name: l.item_name,
                received: l.received_qty,
                track_batches: flags.batches,
                track_serials: flags.serials,
                qty: '',
                batch_no: '',
                serial_nos: '',
                reason: '',
              } as RetLine;
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
    const save$ = this.proxy.create_return(body);
    const flow$ = post
      ? save$.pipe(switchMap((r: ReturnView) => this.proxy.post_return(r.id)))
      : save$;
    flow$.subscribe({
      next: (r) => {
        this.saving.set(false);
        this.notify.success(post ? 'Return posted' : 'Return saved');
        void this.router.navigate(['/procurement/returns', r.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the return.');
      },
    });
  }

  private build(): CreateReturnRequest | null {
    this.formError.set(null);
    if (!this.orderId) {
      this.formError.set('Select a purchase order.');
      return null;
    }
    const date = this.form.return_date;
    if (!date || !date.isValid) {
      this.formError.set('A valid return date is required.');
      return null;
    }
    const lines: ReturnLineRequest[] = [];
    for (const l of this.lines()) {
      const qty = num(l.qty);
      if (qty <= 0) continue;
      if (qty > num(l.received) + 0.0001) {
        this.formError.set(`Cannot return more than received for ${l.sku}.`);
        return null;
      }
      if (l.track_batches && !l.batch_no.trim()) {
        this.formError.set(`${l.sku} tracks batches — enter the batch going back.`);
        return null;
      }
      const serials = l.serial_nos
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (l.track_serials && serials.length === 0) {
        this.formError.set(`${l.sku} tracks serials — enter the units going back.`);
        return null;
      }
      lines.push({
        order_line_id: l.order_line_id,
        qty: qty.toString(),
        batch_no: l.track_batches ? l.batch_no.trim() : undefined,
        serial_nos: l.track_serials ? serials : undefined,
        reason: l.reason.trim() || undefined,
      });
    }
    if (lines.length === 0) {
      this.formError.set('Enter a return quantity on at least one line.');
      return null;
    }
    return {
      order_id: this.orderId,
      return_date: asDateString(date),
      reason: this.form.reason.trim() || undefined,
      reference: this.form.reference.trim() || undefined,
      carrier: this.form.carrier.trim() || undefined,
      memo: this.form.memo.trim() || undefined,
      lines,
    };
  }

  readonly fmtQty = fmtQty;
  readonly num = num;
}
