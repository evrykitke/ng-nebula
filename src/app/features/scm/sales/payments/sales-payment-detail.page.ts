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
import { fmtDate, fmtDateTime, fmtMoney, salesPaymentStatusTones, statusLabel } from '../../shared/scm-format';
import {
  SalesPaymentView,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** One customer payment: header, allocations and the draft → posted → reversed lifecycle. */
@Component({
  selector: 'app-sales-payment-detail-page',
  imports: [PageSkeleton, FormsModule, RouterLink, NgIcon, UiButton, Modal, PageHeader, DocumentPdfButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-payment-detail.page.html',
})
export class SalesPaymentDetailPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.salesPaymentsCreate));
  readonly canPost = computed(() => this.auth.hasPermission(Permissions.salesPaymentsPost));
  readonly canReverse = computed(() => this.auth.hasPermission(Permissions.salesPaymentsReverse));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly payment = signal<SalesPaymentView | null>(null);

  readonly tones = salesPaymentStatusTones;

  readonly reverseModal = signal(false);
  reverseReason = '';

  private id = '';

  readonly fmtDate = fmtDate;
  readonly fmtDateTime = fmtDateTime;
  readonly fmtMoney = fmtMoney;
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
    this.proxy.get_payment2(this.id).subscribe({
      next: (p) => {
        this.payment.set(p);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the payment.');
        this.loading.set(false);
      },
    });
  }

  statusToneClass(status: string): string {
    const tone = this.tones[status] ?? 'muted';
    return tone === 'success'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : tone === 'warning'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-muted text-muted-foreground';
  }

  post(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy.post_payment2(this.id).subscribe({
      next: (p) => {
        this.busy.set(false);
        this.payment.set(p);
        this.notify.success('Payment posted');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not post the payment.');
      },
    });
  }

  openReverse(): void {
    this.reverseReason = '';
    this.reverseModal.set(true);
  }

  confirmReverse(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy.reverse_payment2(this.id, { reason: this.reverseReason.trim() || undefined }).subscribe({
      next: (p) => {
        this.busy.set(false);
        this.reverseModal.set(false);
        this.payment.set(p);
        this.notify.success('Payment reversed');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not reverse the payment.');
      },
    });
  }

  async remove(): Promise<void> {
    if (this.busy()) return;
    const ok = await this.confirm.ask({
      title: 'Delete this draft?',
      message: 'The draft payment and its allocations are removed.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    this.proxy.delete_payment2(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Draft deleted');
        void this.router.navigate(['/sales/payments']);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not delete the draft.');
      },
    });
  }
}
