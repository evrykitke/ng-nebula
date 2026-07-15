import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { fmtMoney, num } from '../../shared/scm-format';
import {
  GlReconciliationView,
  InventoryServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/**
 * Stock ↔ GL reconciliation: the engine's stock value and GRNI position
 * against the balances actually booked in the ledger. Gaps should be zero;
 * a pending outbox explains a temporary one.
 */
@Component({
  selector: 'app-stock-reconciliation-page',
  imports: [NgIcon, UiButton, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reconciliation.page.html',
})
export class StockReconciliationPage {
  private readonly proxy = inject(InventoryServiceProxy);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly view = signal<GlReconciliationView | null>(null);

  readonly fmtMoney = fmtMoney;
  readonly num = num;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.proxy.reconciliation_json().subscribe({
      next: (v) => {
        this.view.set(v);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the reconciliation.');
        this.loading.set(false);
      },
    });
  }

  gapClass(gap: string | undefined): string {
    return gap !== undefined && Math.abs(num(gap)) > 0.005
      ? 'text-destructive'
      : 'text-green-600 dark:text-green-400';
  }
}
