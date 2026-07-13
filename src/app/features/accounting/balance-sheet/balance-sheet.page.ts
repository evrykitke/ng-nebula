import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DateTime } from 'luxon';
import { UiDatepicker } from '../../../shared/ui/datepicker';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../core/services/notification.service';
import { apiErrorInfo } from '../../../shared/api/api-error';
import {
  AccountingServiceProxy,
  BalanceSheet,
} from '../../../shared/service-proxies/service-proxies';

/** The balance sheet: assets against liabilities + equity (with period earnings). */
@Component({
  selector: 'app-balance-sheet-page',
  imports: [UiDatepicker, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './balance-sheet.page.html',
})
export class BalanceSheetPage {
  private readonly proxy = inject(AccountingServiceProxy);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly data = signal<BalanceSheet | null>(null);

  /** As-of cutoff (inclusive); unset means as of today. */
  asOf: DateTime | undefined;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const asOf = this.asOf?.isValid ? this.asOf.toFormat('yyyy-LL-dd') : undefined;
    this.proxy.balance_sheet(asOf).subscribe({
      next: (bs) => {
        this.data.set(bs);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load balance sheet', apiErrorInfo(err).message);
      },
    });
  }

  openLedger(accountId: string): void {
    void this.router.navigate(['/accounting/accounts', accountId, 'ledger']);
  }

  amount(v: string): string {
    return (Number(v) || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  nonZero(v: string): boolean {
    return (Number(v) || 0) !== 0;
  }
}
