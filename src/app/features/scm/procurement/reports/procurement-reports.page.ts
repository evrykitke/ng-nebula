import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DateTime } from 'luxon';
import { UiButton } from '../../../../shared/ui/button';
import { PageSkeleton, Spinner } from '../../../../shared/ui/skeleton';
import { UiDatepicker } from '../../../../shared/ui/datepicker';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { asDateString, fmtMoney, fmtPct, fmtQty } from '../../shared/scm-format';
import {
  GrniView,
  ProcurementServiceProxy,
  SupplierBalancesView,
  SupplierScorecardView,
} from '../../../../shared/service-proxies/service-proxies';

type Tab = 'grni' | 'balances' | 'scorecards';

/**
 * The procurement reporting surface: the GRNI position (received not
 * invoiced), supplier balances owed, and the performance scorecards over a
 * chosen window.
 */
@Component({
  selector: 'app-procurement-reports-page',
  imports: [PageSkeleton, Spinner, RouterLink, UiButton, UiDatepicker, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './procurement-reports.page.html',
})
export class ProcurementReportsPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly notify = inject(NotificationService);

  readonly tab = signal<Tab>('grni');
  readonly loading = signal(false);

  readonly grni = signal<GrniView | null>(null);
  readonly balances = signal<SupplierBalancesView | null>(null);
  readonly scorecards = signal<SupplierScorecardView | null>(null);

  scoreFrom: DateTime | undefined = DateTime.now().minus({ months: 3 }).startOf('month');
  scoreTo: DateTime | undefined = DateTime.now();

  readonly fmtMoney = fmtMoney;
  readonly fmtQty = fmtQty;
  readonly fmtPct = fmtPct;

  constructor() {
    this.loadGrni();
  }

  select(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'grni' && !this.grni()) this.loadGrni();
    if (tab === 'balances' && !this.balances()) this.loadBalances();
    if (tab === 'scorecards' && !this.scorecards()) this.loadScorecards();
  }

  loadGrni(): void {
    this.loading.set(true);
    this.proxy.grni_json().subscribe({
      next: (v) => {
        this.grni.set(v);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load GRNI', apiErrorInfo(err).message);
      },
    });
  }

  loadBalances(): void {
    this.loading.set(true);
    this.proxy.supplier_balances_json().subscribe({
      next: (v) => {
        this.balances.set(v);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load balances', apiErrorInfo(err).message);
      },
    });
  }

  loadScorecards(): void {
    this.loading.set(true);
    this.proxy
      .supplier_scorecards_json(
        this.scoreFrom ? asDateString(this.scoreFrom) : null,
        this.scoreTo ? asDateString(this.scoreTo) : null,
      )
      .subscribe({
        next: (v) => {
          this.scorecards.set(v);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.notify.error('Could not load scorecards', apiErrorInfo(err).message);
        },
      });
  }
}
