import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DateTime } from 'luxon';
import { UiDatepicker } from '../../../shared/ui/datepicker';
import { PageSkeleton } from '../../../shared/ui/skeleton';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../core/services/notification.service';
import { apiErrorInfo } from '../../../shared/api/api-error';
import {
  AccountingServiceProxy,
  AccountLedger,
} from '../../../shared/service-proxies/service-proxies';

/** One account's ledger: its postings in date order with a running balance. */
@Component({
  selector: 'app-account-ledger-page',
  imports: [PageSkeleton, RouterLink, UiDatepicker, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-ledger.page.html',
})
export class AccountLedgerPage {
  private readonly proxy = inject(AccountingServiceProxy);
  private readonly notify = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly data = signal<AccountLedger | null>(null);

  from: DateTime | undefined;
  to: DateTime | undefined;
  private id = '';

  constructor() {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const from = this.from?.isValid ? this.from.toFormat('yyyy-LL-dd') : undefined;
    const to = this.to?.isValid ? this.to.toFormat('yyyy-LL-dd') : undefined;
    this.proxy.account_ledger(this.id, from, to).subscribe({
      next: (l) => {
        this.data.set(l);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load ledger', apiErrorInfo(err).message);
      },
    });
  }

  openEntry(entryId: string): void {
    void this.router.navigate(['/accounting/journal', entryId]);
  }

  fmtDate(d: DateTime | undefined): string {
    return d && d.isValid ? d.toFormat('yyyy-LL-dd') : '—';
  }

  amount(v: string): string {
    const n = Number(v) || 0;
    return n === 0
      ? ''
      : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  balance(v: string): string {
    const n = Number(v) || 0;
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
