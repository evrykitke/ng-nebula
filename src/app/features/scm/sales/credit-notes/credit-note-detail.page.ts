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
import { creditNoteStatusTones, fmtDate, fmtDateTime, fmtMoney, fmtQty, statusLabel } from '../../shared/scm-format';
import {
  CreditNoteView,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** One credit note: header, lines and the draft → posted → cancelled lifecycle. */
@Component({
  selector: 'app-credit-note-detail-page',
  imports: [FormsModule, RouterLink, NgIcon, UiButton, Modal, PageHeader, DocumentPdfButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './credit-note-detail.page.html',
})
export class CreditNoteDetailPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.creditNotesCreate));
  readonly canPost = computed(() => this.auth.hasPermission(Permissions.creditNotesPost));
  readonly canCancel = computed(() => this.auth.hasPermission(Permissions.creditNotesCancel));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly note = signal<CreditNoteView | null>(null);

  readonly tones = creditNoteStatusTones;

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
    this.proxy.get_note(this.id).subscribe({
      next: (c) => {
        this.note.set(c);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the credit note.');
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

  private run(op$: import('rxjs').Observable<CreditNoteView>, msg: string): void {
    this.busy.set(true);
    op$.subscribe({
      next: (c) => {
        this.busy.set(false);
        this.note.set(c);
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
    this.run(this.proxy.post_note(this.id), 'Credit note posted');
  }

  openCancel(): void {
    this.cancelReason = '';
    this.cancelModal.set(true);
  }

  confirmCancel(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy.cancel_note(this.id, { reason: this.cancelReason.trim() || undefined }).subscribe({
      next: (c) => {
        this.busy.set(false);
        this.cancelModal.set(false);
        this.note.set(c);
        this.notify.success('Credit note cancelled');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not cancel the credit note.');
      },
    });
  }

  async remove(): Promise<void> {
    if (this.busy()) return;
    const ok = await this.confirm.ask({
      title: 'Delete this draft?',
      message: 'The draft credit note and its lines are removed.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    this.proxy.delete_note(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Draft deleted');
        void this.router.navigate(['/sales/credit-notes']);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not delete the draft.');
      },
    });
  }
}
