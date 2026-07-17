import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DateTime } from 'luxon';
import { UiDatepicker } from '../../../shared/ui/datepicker';
import { PageSkeleton } from '../../../shared/ui/skeleton';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../core/services/notification.service';
import { apiErrorInfo } from '../../../shared/api/api-error';
import {
  AccountingServiceProxy,
  TrialBalance,
} from '../../../shared/service-proxies/service-proxies';

/** The trial balance: every account's ending balance in its natural column. */
@Component({
  selector: 'app-trial-balance-page',
  imports: [PageSkeleton, UiDatepicker, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trial-balance.page.html',
})
export class TrialBalancePage {
  private readonly proxy = inject(AccountingServiceProxy);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly data = signal<TrialBalance | null>(null);

  /** Optional as-of cutoff (inclusive); unset means all time. */
  asOf: DateTime | undefined;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const asOf = this.asOf?.isValid ? this.asOf.toFormat('yyyy-LL-dd') : undefined;
    this.proxy.trial_balance(asOf).subscribe({
      next: (tb) => {
        this.data.set(tb);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load trial balance', apiErrorInfo(err).message);
      },
    });
  }

  openLedger(accountId: string): void {
    void this.router.navigate(['/accounting/accounts', accountId, 'ledger']);
  }

  amount(v: string): string {
    const n = Number(v) || 0;
    return n === 0
      ? ''
      : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get balanced(): boolean {
    const tb = this.data();
    if (!tb) return false;
    return Math.abs(Number(tb.total_debit) - Number(tb.total_credit)) < 0.005;
  }
}
