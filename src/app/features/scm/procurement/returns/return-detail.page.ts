import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { fmtDate, fmtDateTime, fmtQty, statusLabel } from '../../shared/scm-format';
import {
  ProcurementServiceProxy,
  ReturnView,
} from '../../../../shared/service-proxies/service-proxies';

/** One purchase return with its lines; supports posting a draft and reversing a posting. */
@Component({
  selector: 'app-return-detail-page',
  imports: [RouterLink, NgIcon, UiButton, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './return-detail.page.html',
})
export class ReturnDetailPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.returnsCreate));
  readonly canPost = computed(() => this.auth.hasPermission(Permissions.returnsPost));
  readonly canReverse = computed(() => this.auth.hasPermission(Permissions.returnsReverse));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly ret = signal<ReturnView | null>(null);

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
    this.proxy.get_return(this.id).subscribe({
      next: (r) => {
        this.ret.set(r);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the return.');
        this.loading.set(false);
      },
    });
  }

  statusToneClass(status: string): string {
    return status === 'posted'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : status === 'reversed'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-muted text-muted-foreground';
  }

  post(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy.post_return(this.id).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.ret.set(r);
        this.notify.success('Return posted — stock moved out');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not post the return.');
      },
    });
  }

  async remove(): Promise<void> {
    if (this.busy()) return;
    const ok = await this.confirm.ask({
      title: 'Delete this draft?',
      message: 'The draft return and its lines are removed.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    this.proxy.delete_return(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Draft deleted');
        void this.router.navigate(['/procurement/returns']);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not delete the draft.');
      },
    });
  }

  async reverse(): Promise<void> {
    const r = this.ret();
    if (!r || this.busy()) return;
    const ok = await this.confirm.ask({
      title: `Reverse ${r.number ?? 'this return'}?`,
      message: 'The outbound stock movement is reversed and the return is undone.',
      confirmText: 'Reverse',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    this.proxy.reverse_return(this.id, { reason: `Reversal of ${r.number ?? r.id}` }).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Return reversed');
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not reverse the return.');
      },
    });
  }
}
