import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { Modal } from '../../../../shared/ui/modal';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { fmtCost, fmtDate, fmtQty, num, rfqStatusTones, statusLabel } from '../../shared/scm-format';
import {
  ProcurementServiceProxy,
  QuoteRequest,
  RfqQuoteView,
  RfqSupplierView,
  RfqView,
} from '../../../../shared/service-proxies/service-proxies';

interface QuoteEntry {
  rfq_line_id: string;
  sku: string;
  item_name: string;
  qty: string;
  uom_code: string;
  unit_price: string;
  min_qty: string;
  lead_time_days: string;
  notes: string;
}

/**
 * One RFQ: the line-by-supplier quote comparison matrix and the full
 * lifecycle — send, record each supplier's quotes, close, and award to a
 * draft purchase order. The matrix highlights the lowest quote per line.
 */
@Component({
  selector: 'app-rfq-detail-page',
  imports: [FormsModule, RouterLink, NgIcon, UiButton, Modal, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rfq-detail.page.html',
})
export class RfqDetailPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.rfqsCreate));
  readonly canSend = computed(() => this.auth.hasPermission(Permissions.rfqsSend));
  readonly canRecord = computed(() => this.auth.hasPermission(Permissions.rfqsRecordQuotes));
  readonly canAward = computed(() => this.auth.hasPermission(Permissions.rfqsAward));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly rfq = signal<RfqView | null>(null);

  readonly tones = rfqStatusTones;

  /** The lowest quoted price per line id, for highlighting the winner. */
  readonly bestByLine = computed(() => {
    const out = new Map<string, number>();
    for (const l of this.rfq()?.lines ?? []) {
      let best = Infinity;
      for (const q of l.quotes) {
        const p = num(q.unit_price);
        if (p > 0 && p < best) best = p;
      }
      if (best < Infinity) out.set(l.id, best);
    }
    return out;
  });

  /** A supplier's total quoted value across all lines (0 when unquoted). */
  readonly totalsBySupplier = computed(() => {
    const out = new Map<string, number>();
    const r = this.rfq();
    if (!r) return out;
    for (const s of r.suppliers) {
      let total = 0;
      for (const l of r.lines) {
        const q = l.quotes.find((x) => x.supplier_id === s.supplier_id);
        if (q) total += num(q.unit_price) * num(l.qty);
      }
      out.set(s.supplier_id, total);
    }
    return out;
  });

  // record-quotes modal
  readonly recordModal = signal(false);
  readonly recordSupplierId = signal('');
  readonly recordSupplierName = signal('');
  readonly recordSaving = signal(false);
  readonly recordError = signal<string | null>(null);
  readonly quoteEntries = signal<QuoteEntry[]>([]);

  // award modal
  readonly awardModal = signal(false);
  awardSupplierId = '';

  private id = '';

  readonly fmtCost = fmtCost;
  readonly fmtDate = fmtDate;
  readonly fmtQty = fmtQty;
  readonly statusLabel = statusLabel;
  readonly num = num;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.id = params.get('id') ?? '';
      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.proxy.get_rfq(this.id).subscribe({
      next: (r) => {
        this.rfq.set(r);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the RFQ.');
        this.loading.set(false);
      },
    });
  }

  statusToneClass(status: string): string {
    const tone = this.tones[status] ?? 'muted';
    return tone === 'success'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : tone === 'info'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        : tone === 'warning'
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          : 'bg-muted text-muted-foreground';
  }

  /** The quote for a line × supplier, when one exists. */
  quoteFor(lineId: string, supplierId: string): RfqQuoteView | undefined {
    const line = this.rfq()?.lines.find((l) => l.id === lineId);
    return line?.quotes.find((q) => q.supplier_id === supplierId);
  }

  isBest(lineId: string, price: string): boolean {
    const best = this.bestByLine().get(lineId);
    return best !== undefined && Math.abs(num(price) - best) < 0.0001;
  }

  edit(): void {
    void this.router.navigate(['/procurement/rfqs', this.id, 'edit']);
  }

  private run(op$: import('rxjs').Observable<RfqView>, msg: string): void {
    this.busy.set(true);
    op$.subscribe({
      next: (r) => {
        this.busy.set(false);
        this.rfq.set(r);
        this.notify.success(msg);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'The action failed.');
      },
    });
  }

  send(): void {
    if (this.busy()) return;
    this.run(this.proxy.send_rfq(this.id), 'RFQ sent');
  }

  close(): void {
    if (this.busy()) return;
    this.run(this.proxy.close_rfq(this.id), 'RFQ closed for quoting');
  }

  async cancel(): Promise<void> {
    if (this.busy()) return;
    const ok = await this.confirm.ask({
      title: 'Cancel this RFQ?',
      message: 'It will be closed without an award.',
      confirmText: 'Cancel RFQ',
      tone: 'danger',
    });
    if (!ok) return;
    this.run(this.proxy.cancel_rfq(this.id), 'RFQ cancelled');
  }

  async remove(): Promise<void> {
    if (this.busy()) return;
    const ok = await this.confirm.ask({
      title: 'Delete this draft?',
      message: 'The draft RFQ, its lines and supplier invites are removed.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    this.proxy.delete_rfq(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Draft deleted');
        void this.router.navigate(['/procurement/rfqs']);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not delete the draft.');
      },
    });
  }

  openRecord(supplier: RfqSupplierView): void {
    const r = this.rfq();
    if (!r) return;
    this.recordSupplierId.set(supplier.supplier_id);
    this.recordSupplierName.set(`${supplier.code} — ${supplier.name}`);
    this.quoteEntries.set(
      r.lines.map((l) => {
        const existing = l.quotes.find((q) => q.supplier_id === supplier.supplier_id);
        return {
          rfq_line_id: l.id,
          sku: l.sku,
          item_name: l.item_name,
          qty: l.qty,
          uom_code: l.uom_code,
          unit_price: existing ? String(num(existing.unit_price)) : '',
          min_qty: existing?.min_qty ? String(num(existing.min_qty)) : '',
          lead_time_days: existing?.lead_time_days != null ? String(existing.lead_time_days) : '',
          notes: existing?.notes ?? '',
        };
      }),
    );
    this.recordError.set(null);
    this.recordModal.set(true);
  }

  saveQuotes(): void {
    if (this.recordSaving()) return;
    this.recordError.set(null);
    const quotes: QuoteRequest[] = [];
    for (const e of this.quoteEntries()) {
      if (e.unit_price.trim() === '') continue; // a blank line = no quote for that item
      const price = Number(e.unit_price);
      if (!(price > 0)) {
        this.recordError.set(`Enter a valid price for ${e.sku} (or leave it blank).`);
        return;
      }
      quotes.push({
        rfq_line_id: e.rfq_line_id,
        unit_price: price.toString(),
        min_qty: e.min_qty.trim() ? Number(e.min_qty).toString() : undefined,
        lead_time_days: e.lead_time_days.trim() ? Number(e.lead_time_days) : undefined,
        notes: e.notes.trim() || undefined,
      });
    }
    if (quotes.length === 0) {
      this.recordError.set('Enter at least one quoted price.');
      return;
    }
    this.recordSaving.set(true);
    this.proxy.record_quotes(this.id, { supplier_id: this.recordSupplierId(), quotes }).subscribe({
      next: (r) => {
        this.recordSaving.set(false);
        this.recordModal.set(false);
        this.rfq.set(r);
        this.notify.success('Quotes recorded');
      },
      error: (err) => {
        this.recordSaving.set(false);
        this.recordError.set(apiErrorInfo(err).message || 'Could not record the quotes.');
      },
    });
  }

  openAward(supplierId?: string): void {
    this.awardSupplierId = supplierId ?? '';
    this.awardModal.set(true);
  }

  confirmAward(): void {
    if (this.busy() || !this.awardSupplierId) return;
    this.busy.set(true);
    this.proxy.award_rfq(this.id, { supplier_id: this.awardSupplierId }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.awardModal.set(false);
        this.rfq.set(r);
        this.notify.success('RFQ awarded — draft purchase order created');
        if (r.order_id) void this.router.navigate(['/procurement/orders', r.order_id]);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not award the RFQ.');
      },
    });
  }

  supplierName(id: string): string {
    const s = this.rfq()?.suppliers.find((x) => x.supplier_id === id);
    return s ? `${s.code} — ${s.name}` : '';
  }
}
