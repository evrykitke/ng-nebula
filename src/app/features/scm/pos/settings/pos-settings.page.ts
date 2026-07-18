import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { PageSkeleton } from '../../../../shared/ui/skeleton';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { fmtMoney, num } from '../../shared/scm-format';
import { PosServiceProxy } from '../../../../shared/service-proxies/service-proxies';

/**
 * The two POS policies a tenant sets: whether cashiers count blind, and which
 * notes and coins the count sheet offers. Server-side rules worth knowing
 * here: blind never binds anyone holding Reports.View, and the server always
 * checks counted-vs-expected itself regardless.
 */
@Component({
  selector: 'app-pos-settings-page',
  imports: [FormsModule, NgIcon, UiButton, PageSkeleton, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos-settings.page.html',
})
export class PosSettingsPage {
  private readonly proxy = inject(PosServiceProxy);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(true);
  readonly busy = signal(false);

  blindCount = false;
  denominations: string[] = [];
  newDenomination = '';

  readonly fmtMoney = fmtMoney;

  constructor() {
    this.proxy.get_settings().subscribe({
      next: (s) => {
        this.blindCount = s.blind_count;
        this.denominations = [...s.denominations];
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load POS settings', apiErrorInfo(err).message);
      },
    });
  }

  addDenomination(): void {
    const value = num(this.newDenomination);
    if (value <= 0) {
      this.notify.error('A denomination must be a positive amount.');
      return;
    }
    if (this.denominations.some((d) => num(d) === value)) {
      this.notify.error('That denomination is already in the set.');
      return;
    }
    this.denominations = [...this.denominations, String(value)].sort((a, b) => num(b) - num(a));
    this.newDenomination = '';
  }

  removeDenomination(d: string): void {
    this.denominations = this.denominations.filter((x) => x !== d);
  }

  save(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy
      .put_settings({ blind_count: this.blindCount, denominations: this.denominations })
      .subscribe({
        next: (s) => {
          this.busy.set(false);
          this.blindCount = s.blind_count;
          this.denominations = [...s.denominations];
          this.notify.success('POS settings saved');
        },
        error: (err) => {
          this.busy.set(false);
          this.notify.error(apiErrorInfo(err).message || 'Could not save the settings.');
        },
      });
  }
}
