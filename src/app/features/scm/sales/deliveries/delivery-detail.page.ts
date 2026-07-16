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
import { deliveryStatusTones, fmtDate, fmtDateTime, fmtQty, statusLabel } from '../../shared/scm-format';
import {
  DeliveryView,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** One delivery: header, issued lines and the draft → posted → reversed lifecycle. */
@Component({
  selector: 'app-delivery-detail-page',
  imports: [FormsModule, RouterLink, NgIcon, UiButton, Modal, PageHeader, DocumentPdfButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delivery-detail.page.html',
})
export class DeliveryDetailPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.deliveriesCreate));
  readonly canPost = computed(() => this.auth.hasPermission(Permissions.deliveriesPost));
  readonly canReverse = computed(() => this.auth.hasPermission(Permissions.deliveriesReverse));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly delivery = signal<DeliveryView | null>(null);

  readonly tones = deliveryStatusTones;

  readonly reverseModal = signal(false);
  reverseReason = '';

  private id = '';

  readonly fmtDate = fmtDate;
  readonly fmtDateTime = fmtDateTime;
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
    this.proxy.get_delivery(this.id).subscribe({
      next: (d) => {
        this.delivery.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the delivery.');
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

  private run(op$: import('rxjs').Observable<DeliveryView>, msg: string): void {
    this.busy.set(true);
    op$.subscribe({
      next: (d) => {
        this.busy.set(false);
        this.delivery.set(d);
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
    this.run(this.proxy.post_delivery(this.id), 'Delivery posted');
  }

  openReverse(): void {
    this.reverseReason = '';
    this.reverseModal.set(true);
  }

  confirmReverse(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy.reverse_delivery(this.id, { reason: this.reverseReason.trim() || undefined }).subscribe({
      next: (d) => {
        this.busy.set(false);
        this.reverseModal.set(false);
        this.delivery.set(d);
        this.notify.success('Delivery reversed');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not reverse the delivery.');
      },
    });
  }

  async remove(): Promise<void> {
    if (this.busy()) return;
    const ok = await this.confirm.ask({
      title: 'Delete this draft?',
      message: 'The draft delivery and its lines are removed.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    this.proxy.delete_delivery(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Draft deleted');
        void this.router.navigate(['/sales/deliveries']);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not delete the draft.');
      },
    });
  }
}
