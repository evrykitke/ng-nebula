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
import { fieldText } from '../../../../shared/forms/numeric';
import { fmtCost, fmtDate, fmtMoney, fmtQty, num, orderStatusTones, statusLabel } from '../../shared/scm-format';
import {
  OrderView,
  ProcurementServiceProxy,
  ReceiptHeader,
  ReturnHeader,
} from '../../../../shared/service-proxies/service-proxies';

/**
 * One purchase order: header, line-by-line receive/bill progress, the
 * receipts and returns raised against it, and the submit → approve →
 * receive → close lifecycle.
 */
@Component({
  selector: 'app-order-detail-page',
  imports: [PageSkeleton, FormsModule, RouterLink, NgIcon, UiButton, Modal, PageHeader, DocumentPdfButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail.page.html',
})
export class OrderDetailPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.ordersCreate));
  readonly canSubmit = computed(() => this.auth.hasPermission(Permissions.ordersSubmit));
  readonly canApprove = computed(() => this.auth.hasPermission(Permissions.ordersApprove));
  readonly canCancel = computed(() => this.auth.hasPermission(Permissions.ordersCancel));
  readonly canReceive = computed(() => this.auth.hasPermission(Permissions.receiptsCreate));
  readonly canBill = computed(() => this.auth.hasPermission(Permissions.purchaseInvoicesCreate));
  readonly canReturn = computed(() => this.auth.hasPermission(Permissions.returnsCreate));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly order = signal<OrderView | null>(null);
  readonly receipts = signal<ReceiptHeader[]>([]);
  readonly returns = signal<ReturnHeader[]>([]);

  readonly tones = orderStatusTones;

  /** True once every line is fully received — enables closing. */
  readonly fullyReceived = computed(() => {
    const o = this.order();
    if (!o) return false;
    return o.lines.every((l) => num(l.received_qty) >= num(l.qty) - 0.0001);
  });

  /**
   * True when some line has been received but not yet billed. Both billing
   * and returning draw from this pool, so once it is empty (everything
   * received has been invoiced) neither action applies — the backend
   * rejects them too.
   */
  readonly hasReceivedNotBilled = computed(() => {
    const o = this.order();
    if (!o) return false;
    return o.lines.some((l) => num(l.received_qty) - num(l.billed_qty) > 0.0001);
  });

  // approve modal (captures an exchange rate for foreign-currency orders)
  readonly approveModal = signal(false);
  approveRate = '';

  // cancel modal
  readonly cancelModal = signal(false);
  cancelReason = '';

  private id = '';

  readonly fmtDate = fmtDate;
  readonly fmtQty = fmtQty;
  readonly fmtMoney = fmtMoney;
  readonly fmtCost = fmtCost;
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
    this.proxy.get_order(this.id).subscribe({
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
    this.proxy.order_receipts(this.id).subscribe({
      next: (rows) => this.receipts.set(rows ?? []),
      error: () => {},
    });
    this.proxy.order_returns(this.id).subscribe({
      next: (rows) => this.returns.set(rows ?? []),
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

  progressPct(received: string, qty: string): number {
    const q = num(qty);
    return q > 0 ? Math.min(100, Math.round((num(received) / q) * 100)) : 0;
  }

  edit(): void {
    void this.router.navigate(['/procurement/orders', this.id, 'edit']);
  }

  newReceipt(): void {
    void this.router.navigate(['/procurement/receipts/new'], { queryParams: { order: this.id } });
  }

  newInvoice(): void {
    void this.router.navigate(['/procurement/invoices/new'], { queryParams: { order: this.id } });
  }

  newReturn(): void {
    void this.router.navigate(['/procurement/returns/new'], { queryParams: { order: this.id } });
  }

  private run(op$: import('rxjs').Observable<OrderView>, msg: string): void {
    this.busy.set(true);
    op$.subscribe({
      next: (o) => {
        this.busy.set(false);
        this.order.set(o);
        this.notify.success(msg);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'The action failed.');
      },
    });
  }

  submit(): void {
    if (this.busy()) return;
    this.run(this.proxy.submit_order(this.id), 'Order submitted');
  }

  openApprove(): void {
    this.approveRate = '';
    this.approveModal.set(true);
  }

  confirmApprove(): void {
    if (this.busy()) return;
    this.busy.set(true);
    const body = fieldText(this.approveRate) ? { exchange_rate: Number(this.approveRate).toString() } : {};
    this.proxy.approve_order(this.id, body).subscribe({
      next: (o) => {
        this.busy.set(false);
        this.approveModal.set(false);
        this.order.set(o);
        this.notify.success('Order approved');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not approve the order.');
      },
    });
  }

  close(): void {
    if (this.busy()) return;
    this.run(this.proxy.close_order(this.id), 'Order closed');
  }

  openCancel(): void {
    this.cancelReason = '';
    this.cancelModal.set(true);
  }

  confirmCancel(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy.cancel_order(this.id, { reason: this.cancelReason.trim() || undefined }).subscribe({
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
    this.proxy.delete_order(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Draft deleted');
        void this.router.navigate(['/procurement/orders']);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not delete the draft.');
      },
    });
  }
}
