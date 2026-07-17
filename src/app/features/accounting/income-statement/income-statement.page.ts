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
  IncomeStatement,
} from '../../../shared/service-proxies/service-proxies';

/** The income statement: revenue less expenses over a period, and net income. */
@Component({
  selector: 'app-income-statement-page',
  imports: [PageSkeleton, UiDatepicker, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './income-statement.page.html',
})
export class IncomeStatementPage {
  private readonly proxy = inject(AccountingServiceProxy);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly data = signal<IncomeStatement | null>(null);

  from: DateTime | undefined;
  to: DateTime | undefined;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const from = this.from?.isValid ? this.from.toFormat('yyyy-LL-dd') : undefined;
    const to = this.to?.isValid ? this.to.toFormat('yyyy-LL-dd') : undefined;
    this.proxy.income_statement(from, to).subscribe({
      next: (is) => {
        this.data.set(is);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load income statement', apiErrorInfo(err).message);
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
}
