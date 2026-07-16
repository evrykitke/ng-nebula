import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { Modal } from '../../../../shared/ui/modal';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { DocumentPdfButton } from '../../../../shared/reporting/document-pdf-button';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { fmtDate, fmtDateTime, fmtMoney, fmtQty, salesInvoiceStatusTones, statusLabel } from '../../shared/scm-format';
import {
  SalesInvoiceView,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** One sales invoice: header, lines, settlement and the draft → posted → cancelled lifecycle. */
@Component({
  selector: 'app-sales-invoice-detail-page',
  imports: [FormsModule, RouterLink, NgIcon, UiButton, Modal, PageHeader, DocumentPdfButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-invoice-detail.page.html',
})
export class SalesInvoiceDetailPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.salesInvoicesCreate));
  readonly canPost = computed(() => this.auth.hasPermission(Permissions.salesInvoicesPost));
  readonly canCancel = computed(() => this.auth.hasPermission(Permissions.salesInvoicesCancel));
  readonly canPay = computed(() => this.auth.hasPermission(Permissions.salesPaymentsCreate));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly invoice = signal<SalesInvoiceView | null>(null);

  readonly tones = salesInvoiceStatusTones;

  readonly cancelModal = signal(false);
  cancelReason = '';

  private id = '';

  readonly fmtDate = fmtDate;
  readonly fmtDateTime = fmtDateTime;
  readonly fmtMoney = fmtMoney;
  readonly fmtQty = fmtQty;
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
    this.proxy.get_invoice2(this.id).subscribe({
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
    const tone = this.tones[status] ?? 'muted';
    return tone === 'success'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : tone === 'danger'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
        : 'bg-muted text-muted-foreground';
  }

  settlementLabel(s: string): string {
    return statusLabel(s);
  }

  pay(): void {
    const i = this.invoice();
    if (!i) return;
    void this.router.navigate(['/sales/payments/new'], { queryParams: { customer: i.customer_id } });
  }

  private run(op$: import('rxjs').Observable<SalesInvoiceView>, msg: string): void {
    this.busy.set(true);
    op$.subscribe({
      next: (i) => {
        this.busy.set(false);
        this.invoice.set(i);
        this.notify.success(msg);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'The action failed.');
      },
    });
  }

  post(): void {
    if (this.busy()) return;
    this.run(this.proxy.post_invoice2(this.id), 'Invoice posted');
  }

  openCancel(): void {
    this.cancelReason = '';
    this.cancelModal.set(true);
  }

  confirmCancel(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy.cancel_invoice2(this.id, { reason: this.cancelReason.trim() || undefined }).subscribe({
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
    this.proxy.delete_invoice2(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Draft deleted');
        void this.router.navigate(['/sales/invoices']);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not delete the draft.');
      },
    });
  }
}
