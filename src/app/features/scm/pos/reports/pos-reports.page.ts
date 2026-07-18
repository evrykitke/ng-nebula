import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DateTime } from 'luxon';
import { UiButton } from '../../../../shared/ui/button';
import { UiDatepicker } from '../../../../shared/ui/datepicker';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { ReportDrawer } from '../../../../shared/reporting/report-drawer';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { asDateString, fmtDateTime, fmtMoney, fmtPct, fmtQty } from '../../shared/scm-format';
import { tenderLabel } from '../shared/pos-format';
import {
  HourlyView,
  ItemSalesView,
  PosServiceProxy,
  SessionSummaryView,
  TenderMixView,
} from '../../../../shared/service-proxies/service-proxies';

type Tab = 'sessions' | 'tenders' | 'items' | 'hourly';

/** The framework report behind each tab, for the PDF button. */
const REPORT_NAMES: Record<Tab, string> = {
  sessions: 'pos-sessions',
  tenders: 'pos-tender-mix',
  items: 'pos-item-sales',
  hourly: 'pos-hourly-sales',
};

/**
 * The POS reporting surface over a chosen window: sessions summarized, the
 * tender mix, what sold, and the shape of the day hour by hour. Each tab reads
 * the same queries the printable reports draw from, and its PDF button opens
 * exactly that report — the table and the letterhead can never disagree.
 */
@Component({
  selector: 'app-pos-reports-page',
  imports: [RouterLink, UiButton, UiDatepicker, PageHeader, ReportDrawer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos-reports.page.html',
})
export class PosReportsPage {
  private readonly proxy = inject(PosServiceProxy);
  private readonly notify = inject(NotificationService);

  readonly tab = signal<Tab>('sessions');
  readonly loading = signal(false);
  readonly pdfOpen = signal(false);

  readonly sessions = signal<SessionSummaryView | null>(null);
  readonly tenders = signal<TenderMixView | null>(null);
  readonly items = signal<ItemSalesView | null>(null);
  readonly hourly = signal<HourlyView | null>(null);

  from: DateTime | undefined = DateTime.now().startOf('month');
  to: DateTime | undefined = DateTime.now();

  /** The browser's own offset (minutes east of UTC) — the shop's clock, for the hourly buckets. */
  private readonly tzOffset = DateTime.now().offset;

  readonly fmtMoney = fmtMoney;
  readonly fmtQty = fmtQty;
  readonly fmtPct = fmtPct;
  readonly fmtDateTime = fmtDateTime;
  readonly tenderLabel = tenderLabel;

  readonly pdfReport = computed(() => REPORT_NAMES[this.tab()]);
  readonly pdfParams = computed<Record<string, string>>(() => {
    const params: Record<string, string> = {};
    if (this.from) params['from'] = this.from.toFormat('yyyy-LL-dd');
    if (this.to) params['to'] = this.to.toFormat('yyyy-LL-dd');
    if (this.tab() === 'hourly') params['tz_offset'] = String(this.tzOffset);
    return params;
  });

  constructor() {
    this.reload();
  }

  select(tab: Tab): void {
    this.tab.set(tab);
    if (
      (tab === 'sessions' && !this.sessions()) ||
      (tab === 'tenders' && !this.tenders()) ||
      (tab === 'items' && !this.items()) ||
      (tab === 'hourly' && !this.hourly())
    ) {
      this.reload();
    }
  }

  /** Refetch the active tab for the chosen window; the others reload on entry. */
  reload(): void {
    const from = this.from ? asDateString(this.from) : null;
    const to = this.to ? asDateString(this.to) : null;
    this.sessions.set(null);
    this.tenders.set(null);
    this.items.set(null);
    this.hourly.set(null);
    this.loading.set(true);
    const done = () => this.loading.set(false);
    const fail = (what: string) => (err: unknown) => {
      done();
      this.notify.error(`Could not load ${what}`, apiErrorInfo(err).message);
    };
    switch (this.tab()) {
      case 'sessions':
        this.proxy.sessions_json(from, to, null).subscribe({
          next: (v) => {
            this.sessions.set(v);
            done();
          },
          error: fail('the session summary'),
        });
        break;
      case 'tenders':
        this.proxy.tender_mix_json(from, to).subscribe({
          next: (v) => {
            this.tenders.set(v);
            done();
          },
          error: fail('the tender mix'),
        });
        break;
      case 'items':
        this.proxy.item_sales_json(from, to).subscribe({
          next: (v) => {
            this.items.set(v);
            done();
          },
          error: fail('item sales'),
        });
        break;
      case 'hourly':
        this.proxy.hourly_json(from, to, this.tzOffset).subscribe({
          next: (v) => {
            this.hourly.set(v);
            done();
          },
          error: fail('hourly sales'),
        });
        break;
    }
  }

  hourLabel(hour: number): string {
    const h = String(hour).padStart(2, '0');
    return `${h}:00–${h}:59`;
  }
}
