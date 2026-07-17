import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { PageSkeleton } from '../../../../shared/ui/skeleton';
import { Modal } from '../../../../shared/ui/modal';
import { Lookup } from '../../../../shared/lookup/lookup';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { DocumentPdfButton } from '../../../../shared/reporting/document-pdf-button';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { fmtDate, fmtQty, requisitionStatusTones, statusLabel } from '../../shared/scm-format';
import { supplierLookup } from '../../shared/scm-lookups';
import {
  ProcurementServiceProxy,
  ProcurementSupplier,
  RequisitionView,
} from '../../../../shared/service-proxies/service-proxies';

/** One requisition with its lines and the approval → conversion lifecycle. */
@Component({
  selector: 'app-requisition-detail-page',
  imports: [PageSkeleton, FormsModule, RouterLink, NgIcon, UiButton, Modal, Lookup, PageHeader, DocumentPdfButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './requisition-detail.page.html',
})
export class RequisitionDetailPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.requisitionsCreate));
  readonly canSubmit = computed(() => this.auth.hasPermission(Permissions.requisitionsSubmit));
  readonly canApprove = computed(() => this.auth.hasPermission(Permissions.requisitionsApprove));
  readonly canConvert = computed(() => this.auth.hasPermission(Permissions.requisitionsConvert));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly req = signal<RequisitionView | null>(null);

  readonly tones = requisitionStatusTones;

  // convert modal
  readonly convertModal = signal(false);
  readonly convertSupplierId = signal('');
  readonly convertSupplierLabel = signal('');
  readonly supplierLookup = supplierLookup(this.proxy, (s) => s.is_active && !s.on_hold);

  // reject modal
  readonly rejectModal = signal(false);
  rejectReason = '';

  private id = '';

  readonly fmtDate = fmtDate;
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
    this.proxy.get_requisition(this.id).subscribe({
      next: (r) => {
        this.req.set(r);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the requisition.');
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
        : tone === 'danger'
          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          : 'bg-muted text-muted-foreground';
  }

  edit(): void {
    void this.router.navigate(['/procurement/requisitions', this.id, 'edit']);
  }

  private run(op$: import('rxjs').Observable<RequisitionView>, msg: string): void {
    this.busy.set(true);
    op$.subscribe({
      next: (r) => {
        this.busy.set(false);
        this.req.set(r);
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
    this.run(this.proxy.submit_requisition(this.id), 'Requisition submitted');
  }

  approve(): void {
    if (this.busy()) return;
    this.run(this.proxy.approve_requisition(this.id), 'Requisition approved');
  }

  async cancel(): Promise<void> {
    if (this.busy()) return;
    const ok = await this.confirm.ask({
      title: 'Cancel this requisition?',
      message: 'It will be closed without a purchase order.',
      confirmText: 'Cancel requisition',
      tone: 'danger',
    });
    if (!ok) return;
    this.run(this.proxy.cancel_requisition(this.id), 'Requisition cancelled');
  }

  async remove(): Promise<void> {
    if (this.busy()) return;
    const ok = await this.confirm.ask({
      title: 'Delete this draft?',
      message: 'The draft requisition and its lines are removed.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    this.proxy.delete_requisition(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Draft deleted');
        void this.router.navigate(['/procurement/requisitions']);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not delete the draft.');
      },
    });
  }

  openReject(): void {
    this.rejectReason = '';
    this.rejectModal.set(true);
  }

  confirmReject(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy.reject_requisition(this.id, { reason: this.rejectReason.trim() || undefined }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.rejectModal.set(false);
        this.req.set(r);
        this.notify.success('Requisition rejected');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not reject the requisition.');
      },
    });
  }

  openConvert(): void {
    this.convertSupplierId.set('');
    this.convertSupplierLabel.set('');
    this.convertModal.set(true);
  }

  onSupplierSelected(s: ProcurementSupplier): void {
    this.convertSupplierId.set(s.id);
    this.convertSupplierLabel.set(`${s.code} — ${s.name}`);
  }

  confirmConvert(): void {
    if (this.busy() || !this.convertSupplierId()) return;
    this.busy.set(true);
    this.proxy.convert_requisition(this.id, { supplier_id: this.convertSupplierId() }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.convertModal.set(false);
        this.req.set(r);
        this.notify.success('Draft purchase order created');
        if (r.order_id) void this.router.navigate(['/procurement/orders', r.order_id]);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not convert the requisition.');
      },
    });
  }
}
