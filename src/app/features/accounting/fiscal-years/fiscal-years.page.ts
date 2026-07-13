import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon } from '@ng-icons/core';
import { DateTime } from 'luxon';
import { Observable } from 'rxjs';
import { UiButton } from '../../../shared/ui/button';
import { UiDatepicker } from '../../../shared/ui/datepicker';
import { Modal } from '../../../shared/ui/modal';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { AuthService } from '../../../core/auth/auth.service';
import { Permissions } from '../../../core/auth/permissions.constants';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { apiErrorInfo } from '../../../shared/api/api-error';
import {
  AccountingServiceProxy,
  CreateFiscalYearRequest,
  FiscalPeriodView,
  FiscalYearView,
} from '../../../shared/service-proxies/service-proxies';

/**
 * Fiscal years — the posting calendar. Each year carries twelve monthly
 * periods; entries only post into open periods, so closing a period finalises
 * a month and locking makes that permanent.
 */
@Component({
  selector: 'app-fiscal-years-page',
  imports: [FormsModule, NgIcon, UiButton, UiDatepicker, PageHeader, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fiscal-years.page.html',
})
export class FiscalYearsPage {
  private readonly proxy = inject(AccountingServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  readonly canManage = computed(() => this.auth.hasPermission(Permissions.fiscalYearsManage));

  readonly years = signal<FiscalYearView[]>([]);
  readonly loading = signal(true);
  /** The year whose periods are expanded (newest by default). */
  readonly expanded = signal<string | null>(null);

  // Create dialog.
  readonly creating = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  form: { name: string; start_date: DateTime | undefined } = {
    name: '',
    start_date: undefined,
  };

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.proxy.list_fiscal_years().subscribe({
      next: (list) => {
        this.years.set(list ?? []);
        this.loading.set(false);
        if (!this.expanded() && list?.length) this.expanded.set(list[0].id);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load fiscal years', apiErrorInfo(err).message);
      },
    });
  }

  /** Badge classes for a year/period status. */
  statusClass(status: string): string {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
      case 'closed':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      default: // locked
        return 'bg-muted text-muted-foreground';
    }
  }

  fmtDate(d: DateTime | undefined): string {
    return d && d.isValid ? d.toFormat('dd LLL yyyy') : '—';
  }

  toggle(id: string): void {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  openCreate(): void {
    this.form = { name: '', start_date: DateTime.now().startOf('year') };
    this.formError.set(null);
    this.creating.set(true);
  }

  save(): void {
    if (this.saving()) return;
    if (!this.form.start_date || !this.form.start_date.isValid) {
      this.formError.set('A start date is required.');
      return;
    }
    this.saving.set(true);
    const body = {
      name: this.form.name.trim() || undefined,
      // Backend expects a NaiveDate; the proxy JSON.stringifies the body, so a
      // plain date string serializes correctly.
      start_date: this.form.start_date.toFormat('yyyy-LL-dd'),
    } as unknown as CreateFiscalYearRequest;
    this.proxy.create_fiscal_year(body).subscribe({
      next: (year) => {
        this.saving.set(false);
        this.creating.set(false);
        this.notify.success(`${year.name} created with 12 periods`);
        this.expanded.set(year.id);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not create the fiscal year.');
      },
    });
  }

  close(p: FiscalPeriodView): void {
    this.transition(p, 'closed', () => this.proxy.close_period(p.id));
  }

  reopen(p: FiscalPeriodView): void {
    this.transition(p, 'reopened', () => this.proxy.reopen_period(p.id));
  }

  async lock(p: FiscalPeriodView): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Lock ${p.name}?`,
      message: 'A locked period is final — it can never be reopened for posting.',
      confirmText: 'Lock',
      tone: 'danger',
    });
    if (!ok) return;
    this.transition(p, 'locked', () => this.proxy.lock_period(p.id));
  }

  private transition(
    p: FiscalPeriodView,
    verb: string,
    call: () => Observable<FiscalYearView>,
  ): void {
    call().subscribe({
      next: () => {
        this.notify.success(`${p.name} ${verb}`);
        this.load();
      },
      error: (err) => this.notify.error(apiErrorInfo(err).message || 'Update failed'),
    });
  }
}
