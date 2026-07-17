import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { PageSkeleton } from '../../../../shared/ui/skeleton';
import { Modal } from '../../../../shared/ui/modal';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { DocumentPdfButton } from '../../../../shared/reporting/document-pdf-button';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { fmtDate, fmtMoney, fmtQty, num, salesOrderStatusTones, statusLabel } from '../../shared/scm-format';
import {
  DeliveryHeader,
  SalesInvoiceHeader,
  SalesOrderView,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/**
 * One sales order: header, per-line reserve/deliver/bill progress, the
 * deliveries and invoices raised against it, and the confirm → reserve →
 * deliver → bill → close lifecycle.
 */
@Component({
  selector: 'app-sales-order-detail-page',
  imports: [PageSkeleton, FormsModule, RouterLink, NgIcon, UiButton, Modal, PageHeader, DocumentPdfButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-order-detail.page.html',
})
export class SalesOrderDetailPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.salesOrdersCreate));
  readonly canConfirm = computed(() => this.auth.hasPermission(Permissions.salesOrdersConfirm));
  readonly canCancel = computed(() => this.auth.hasPermission(Permissions.salesOrdersCancel));
  readonly canClose = computed(() => this.auth.hasPermission(Permissions.salesOrdersClose));
  readonly canDeliver = computed(() => this.auth.hasPermission(Permissions.deliveriesCreate));
  readonly canBill = computed(() => this.auth.hasPermission(Permissions.salesInvoicesCreate));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly order = signal<SalesOrderView | null>(null);
  readonly deliveries = signal<DeliveryHeader[]>([]);
  readonly invoices = signal<SalesInvoiceHeader[]>([]);

  readonly tones = salesOrderStatusTones;

  /** Some line has been delivered but not yet billed — billing draws from this pool. */
  readonly hasDeliveredNotBilled = computed(() => {
    const o = this.order();
    if (!o) return false;
    return o.lines.some((l) => num(l.delivered_qty) - num(l.billed_qty) > 0.0001);
  });

  readonly fullyDelivered = computed(() => {
    const o = this.order();
    if (!o) return false;
    return o.lines.every((l) => num(l.delivered_qty) >= num(l.qty) - 0.0001);
  });

  // confirm modal (captures an exchange rate for foreign-currency orders)
  readonly confirmModal = signal(false);
  confirmRate = '';

  // cancel modal
  readonly cancelModal = signal(false);
  cancelReason = '';

  private id = '';

  readonly fmtDate = fmtDate;
  readonly fmtQty = fmtQty;
  readonly fmtMoney = fmtMoney;
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
    this.proxy.get_order2(this.id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.loading.set(false);
        this.loadLinked();
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the order.');
        this.loading.set(false);
      },
    });
  }

  private loadLinked(): void {
    this.proxy.order_deliveries(this.id).subscribe({
      next: (rows) => this.deliveries.set(rows ?? []),
      error: () => {},
    });
    this.proxy.order_invoices(this.id).subscribe({
      next: (rows) => this.invoices.set(rows ?? []),
      error: () => {},
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
          : tone === 'danger'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            : 'bg-muted text-muted-foreground';
  }

  progressPct(done: string, qty: string): number {
    const q = num(qty);
    return q > 0 ? Math.min(100, Math.round((num(done) / q) * 100)) : 0;
  }

  edit(): void {
    void this.router.navigate(['/sales/orders', this.id, 'edit']);
  }

  newDelivery(): void {
    void this.router.navigate(['/sales/deliveries/new'], { queryParams: { order: this.id } });
  }

  newInvoice(): void {
    void this.router.navigate(['/sales/invoices/new'], { queryParams: { order: this.id } });
  }

  private run(op$: import('rxjs').Observable<SalesOrderView>, msg: string): void {
    this.busy.set(true);
    op$.subscribe({
      next: (o) => {
        this.busy.set(false);
        this.order.set(o);
        this.notify.success(msg);
        this.loadLinked();
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'The action failed.');
      },
    });
  }

  openConfirm(): void {
    this.confirmRate = '';
    this.confirmModal.set(true);
  }

  doConfirm(): void {
    if (this.busy()) return;
    this.busy.set(true);
    const body = this.confirmRate.trim() ? { exchange_rate: Number(this.confirmRate).toString() } : {};
    this.proxy.confirm_order(this.id, body).subscribe({
      next: (o) => {
        this.busy.set(false);
        this.confirmModal.set(false);
        this.order.set(o);
        this.notify.success('Order confirmed');
        this.loadLinked();
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not confirm the order.');
      },
    });
  }

  reserve(): void {
    if (this.busy()) return;
    this.run(this.proxy.reserve_order(this.id), 'Stock reserved');
  }

  close(): void {
    if (this.busy()) return;
    this.run(this.proxy.close_order2(this.id), 'Order closed');
  }

  openCancel(): void {
    this.cancelReason = '';
    this.cancelModal.set(true);
  }

  confirmCancel(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy.cancel_order2(this.id, { reason: this.cancelReason.trim() || undefined }).subscribe({
      next: (o) => {
        this.busy.set(false);
        this.cancelModal.set(false);
        this.order.set(o);
        this.notify.success('Order cancelled');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not cancel the order.');
      },
    });
  }

  async remove(): Promise<void> {
    if (this.busy()) return;
    const ok = await this.confirm.ask({
      title: 'Delete this draft?',
      message: 'The draft order and its lines are removed.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    this.proxy.delete_order2(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Draft deleted');
        void this.router.navigate(['/sales/orders']);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not delete the draft.');
      },
    });
  }
}
