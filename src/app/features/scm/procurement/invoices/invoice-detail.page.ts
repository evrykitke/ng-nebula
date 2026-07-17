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
import { fmtCost, fmtDate, fmtDateTime, fmtMoney, fmtQty, statusLabel } from '../../shared/scm-format';
import {
  InvoiceView,
  ProcurementServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** One purchase invoice with its lines; supports posting a draft and cancelling. */
@Component({
  selector: 'app-invoice-detail-page',
  imports: [PageSkeleton, FormsModule, RouterLink, NgIcon, UiButton, Modal, PageHeader, DocumentPdfButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-detail.page.html',
})
export class InvoiceDetailPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.purchaseInvoicesCreate));
  readonly canPost = computed(() => this.auth.hasPermission(Permissions.purchaseInvoicesPost));
  readonly canCancel = computed(() => this.auth.hasPermission(Permissions.purchaseInvoicesCancel));
  readonly canPay = computed(() => this.auth.hasPermission(Permissions.paymentsCreate));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly invoice = signal<InvoiceView | null>(null);

  readonly cancelModal = signal(false);
  cancelReason = '';

  private id = '';

  readonly fmtDate = fmtDate;
  readonly fmtDateTime = fmtDateTime;
  readonly fmtQty = fmtQty;
  readonly fmtMoney = fmtMoney;
  readonly fmtCost = fmtCost;
  readonly statusLabel = statusLabel;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.id = params.get('id') ?? '';
      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.proxy.get_invoice(this.id).subscribe({
      next: (i) => {
        this.invoice.set(i);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the invoice.');
        this.loading.set(false);
      },
    });
  }

  statusToneClass(status: string): string {
    return status === 'posted'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : status === 'cancelled'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
        : 'bg-muted text-muted-foreground';
  }

  post(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy.post_invoice(this.id).subscribe({
      next: (i) => {
        this.busy.set(false);
        this.invoice.set(i);
        this.notify.success('Invoice posted to the ledger');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not post the invoice.');
      },
    });
  }

  async remove(): Promise<void> {
    if (this.busy()) return;
    const ok = await this.confirm.ask({
      title: 'Delete this draft?',
      message: 'The draft invoice and its lines are removed.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    this.proxy.delete_invoice(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Draft deleted');
        void this.router.navigate(['/procurement/invoices']);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not delete the draft.');
      },
    });
  }

  pay(): void {
    void this.router.navigate(['/procurement/payments/new']);
  }

  settlementToneClass(settlement: string): string {
    return settlement === 'paid'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : settlement === 'partially_paid'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-muted text-muted-foreground';
  }

  openCancel(): void {
    this.cancelReason = '';
    this.cancelModal.set(true);
  }

  confirmCancel(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy.cancel_invoice(this.id, { reason: this.cancelReason.trim() || undefined }).subscribe({
      next: (i) => {
        this.busy.set(false);
        this.cancelModal.set(false);
        this.invoice.set(i);
        this.notify.success('Invoice cancelled');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not cancel the invoice.');
      },
    });
  }
}
