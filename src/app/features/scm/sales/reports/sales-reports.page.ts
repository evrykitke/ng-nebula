import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DateTime } from 'luxon';
import { UiButton } from '../../../../shared/ui/button';
import { PageSkeleton } from '../../../../shared/ui/skeleton';
import { UiDatepicker } from '../../../../shared/ui/datepicker';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { asDateString, fmtDate, fmtMoney, fmtPct, fmtQty } from '../../shared/scm-format';
import {
  ArAgingView,
  ArReconciliationView,
  DnbView,
  MarginsView,
  RegisterView,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

type Tab = 'aging' | 'recon' | 'dnb' | 'margins' | 'register';

/**
 * The sales reporting surface: AR aging, the AR-vs-ledger reconciliation, the
 * delivered-not-billed position, item margins and the invoice register over a
 * chosen window.
 */
@Component({
  selector: 'app-sales-reports-page',
  imports: [PageSkeleton, RouterLink, UiButton, UiDatepicker, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-reports.page.html',
})
export class SalesReportsPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly notify = inject(NotificationService);

  readonly tab = signal<Tab>('aging');
  readonly loading = signal(false);

  readonly aging = signal<ArAgingView | null>(null);
  readonly recon = signal<ArReconciliationView | null>(null);
  readonly dnb = signal<DnbView | null>(null);
  readonly margins = signal<MarginsView | null>(null);
  readonly register = signal<RegisterView | null>(null);

  asOf: DateTime | undefined = DateTime.now();
  periodFrom: DateTime | undefined = DateTime.now().startOf('month');
  periodTo: DateTime | undefined = DateTime.now();

  readonly fmtMoney = fmtMoney;
  readonly fmtQty = fmtQty;
  readonly fmtPct = fmtPct;
  readonly fmtDate = fmtDate;

  constructor() {
    this.loadAging();
  }

  select(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'aging' && !this.aging()) this.loadAging();
    if (tab === 'recon' && !this.recon()) this.loadRecon();
    if (tab === 'dnb' && !this.dnb()) this.loadDnb();
    if (tab === 'margins' && !this.margins()) this.loadMargins();
    if (tab === 'register' && !this.register()) this.loadRegister();
  }

  loadAging(): void {
    this.loading.set(true);
    this.proxy.ar_aging_json(this.asOf ? asDateString(this.asOf) : null).subscribe({
      next: (v) => {
        this.aging.set(v);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load AR aging', apiErrorInfo(err).message);
      },
    });
  }

  loadRecon(): void {
    this.loading.set(true);
    this.proxy.ar_recon_json().subscribe({
      next: (v) => {
        this.recon.set(v);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load reconciliation', apiErrorInfo(err).message);
      },
    });
  }

  loadDnb(): void {
    this.loading.set(true);
    this.proxy.dnb_json().subscribe({
      next: (v) => {
        this.dnb.set(v);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load delivered-not-billed', apiErrorInfo(err).message);
      },
    });
  }

  loadMargins(): void {
    this.loading.set(true);
    this.proxy
      .margins_json(
        this.periodFrom ? asDateString(this.periodFrom) : null,
        this.periodTo ? asDateString(this.periodTo) : null,
      )
      .subscribe({
        next: (v) => {
          this.margins.set(v);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.notify.error('Could not load margins', apiErrorInfo(err).message);
        },
      });
  }

  loadRegister(): void {
    this.loading.set(true);
    this.proxy
      .register_json(
        this.periodFrom ? asDateString(this.periodFrom) : null,
        this.periodTo ? asDateString(this.periodTo) : null,
        null,
      )
      .subscribe({
        next: (v) => {
          this.register.set(v);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.notify.error('Could not load register', apiErrorInfo(err).message);
        },
      });
  }
}
