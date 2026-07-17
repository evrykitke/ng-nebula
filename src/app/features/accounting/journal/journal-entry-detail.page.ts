import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { DateTime } from 'luxon';
import { UiButton } from '../../../shared/ui/button';
import { PageSkeleton } from '../../../shared/ui/skeleton';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { AuthService } from '../../../core/auth/auth.service';
import { Permissions } from '../../../core/auth/permissions.constants';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { apiErrorInfo } from '../../../shared/api/api-error';
import {
  AccountingServiceProxy,
  JournalEntryView,
} from '../../../shared/service-proxies/service-proxies';

/** One journal entry with its lines; supports posting a draft and reversing a posting. */
@Component({
  selector: 'app-journal-entry-detail-page',
  imports: [PageSkeleton, RouterLink, NgIcon, UiButton, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './journal-entry-detail.page.html',
})
export class JournalEntryDetailPage {
  private readonly proxy = inject(AccountingServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canPost = computed(() => this.auth.hasPermission(Permissions.journalPost));
  readonly canReverse = computed(() => this.auth.hasPermission(Permissions.journalReverse));
  readonly canEdit = computed(() => this.auth.hasPermission(Permissions.journalCreate));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly entry = signal<JournalEntryView | null>(null);

  private id = '';

  constructor() {
    // React to param changes: reversal cross-links navigate between entries,
    // which reuses this component — snapshot alone would never reload.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.id = params.get('id') ?? '';
      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);
    this.proxy.get_entry(this.id).subscribe({
      next: (e) => {
        this.entry.set(e);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the entry.');
        this.loading.set(false);
      },
    });
  }

  post(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy.post_entry(this.id).subscribe({
      next: (e) => {
        this.busy.set(false);
        this.entry.set(e);
        this.notify.success('Entry posted');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not post the entry.');
      },
    });
  }

  edit(): void {
    void this.router.navigate(['/accounting/journal', this.id, 'edit']);
  }

  async remove(): Promise<void> {
    const e = this.entry();
    if (!e || this.busy()) return;
    const ok = await this.confirm.ask({
      title: 'Delete this draft?',
      message: 'The draft and its lines are removed. Only drafts can be deleted.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    this.proxy.delete_entry(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Draft deleted');
        void this.router.navigate(['/accounting/journal']);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not delete the draft.');
      },
    });
  }

  async reverse(): Promise<void> {
    const e = this.entry();
    if (!e || this.busy()) return;
    const ok = await this.confirm.ask({
      title: `Reverse ${e.number ?? 'this entry'}?`,
      message:
        'A mirror entry is posted that cancels this one. Both stay in the ledger for audit.',
      confirmText: 'Reverse',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    this.proxy.reverse_entry(this.id, { reason: `Reversal of ${e.number ?? e.id}` }).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Entry reversed');
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not reverse the entry.');
      },
    });
  }

  fmtDate(d: DateTime | undefined): string {
    return d && d.isValid ? d.toFormat('yyyy-LL-dd') : '—';
  }

  fmtDateTime(d: DateTime | undefined): string {
    return d && d.isValid ? d.toFormat('yyyy-LL-dd HH:mm') : '—';
  }

  amount(v: string): string {
    const n = Number(v) || 0;
    return n === 0 ? '' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
