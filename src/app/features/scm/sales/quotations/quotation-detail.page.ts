import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { DateTime } from 'luxon';
import { UiButton } from '../../../../shared/ui/button';
import { UiDatepicker } from '../../../../shared/ui/datepicker';
import { Lookup } from '../../../../shared/lookup/lookup';
import { Modal } from '../../../../shared/ui/modal';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { DocumentPdfButton } from '../../../../shared/reporting/document-pdf-button';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { asDateString, fmtDate, fmtMoney, fmtQty, num, quotationStatusTones, statusLabel } from '../../shared/scm-format';
import { warehouseLookup } from '../../shared/scm-lookups';
import {
  InventoryServiceProxy,
  QuotationView,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** One quotation: header, lines and the draft → sent → accepted → converted lifecycle. */
@Component({
  selector: 'app-quotation-detail-page',
  imports: [FormsModule, RouterLink, NgIcon, UiButton, UiDatepicker, Lookup, Modal, PageHeader, DocumentPdfButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quotation-detail.page.html',
})
export class QuotationDetailPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly inventory = inject(InventoryServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.quotationsCreate));
  readonly canSend = computed(() => this.auth.hasPermission(Permissions.quotationsSend));
  readonly canConvert = computed(() => this.auth.hasPermission(Permissions.quotationsConvert));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly quotation = signal<QuotationView | null>(null);

  readonly tones = quotationStatusTones;
  readonly warehouseLookup = warehouseLookup(this.inventory);

  // convert modal
  readonly convertModal = signal(false);
  convertWarehouseId = '';
  convertWarehouseLabel = '';
  convertExpected: DateTime | undefined = undefined;

  // decline modal
  readonly declineModal = signal(false);
  declineReason = '';

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
    this.proxy.get_quotation(this.id).subscribe({
      next: (q) => {
        this.quotation.set(q);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the quotation.');
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
          : tone === 'danger'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            : 'bg-muted text-muted-foreground';
  }

  edit(): void {
    void this.router.navigate(['/sales/quotations', this.id, 'edit']);
  }

  private run(op$: import('rxjs').Observable<QuotationView>, msg: string): void {
    this.busy.set(true);
    op$.subscribe({
      next: (q) => {
        this.busy.set(false);
        this.quotation.set(q);
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
    this.run(this.proxy.send_quotation(this.id), 'Quotation sent');
  }

  accept(): void {
    if (this.busy()) return;
    this.run(this.proxy.accept_quotation(this.id), 'Quotation accepted');
  }

  openDecline(): void {
    this.declineReason = '';
    this.declineModal.set(true);
  }

  confirmDecline(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy.decline_quotation(this.id, { reason: this.declineReason.trim() || undefined }).subscribe({
      next: (q) => {
        this.busy.set(false);
        this.declineModal.set(false);
        this.quotation.set(q);
        this.notify.success('Quotation declined');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not decline the quotation.');
      },
    });
  }

  openConvert(): void {
    this.convertWarehouseId = '';
    this.convertWarehouseLabel = '';
    this.convertExpected = undefined;
    this.convertModal.set(true);
  }

  confirmConvert(): void {
    if (this.busy()) return;
    if (!this.convertWarehouseId) {
      this.notify.error('Pick a warehouse to fulfil from.');
      return;
    }
    this.busy.set(true);
    this.proxy
      .convert_quotation(this.id, {
        warehouse_id: this.convertWarehouseId,
        expected_date: this.convertExpected ? asDateString(this.convertExpected) : undefined,
      })
      .subscribe({
        next: (q) => {
          this.busy.set(false);
          this.convertModal.set(false);
          this.quotation.set(q);
          this.notify.success('Converted to a sales order');
          if (q.converted_to_id) void this.router.navigate(['/sales/orders', q.converted_to_id]);
        },
        error: (err) => {
          this.busy.set(false);
          this.notify.error(apiErrorInfo(err).message || 'Could not convert the quotation.');
        },
      });
  }

  async remove(): Promise<void> {
    if (this.busy()) return;
    const ok = await this.confirm.ask({
      title: 'Delete this draft?',
      message: 'The draft quotation and its lines are removed.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    this.proxy.delete_quotation(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Draft deleted');
        void this.router.navigate(['/sales/quotations']);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not delete the draft.');
      },
    });
  }
}
