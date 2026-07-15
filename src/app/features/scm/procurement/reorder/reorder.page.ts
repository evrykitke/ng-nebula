import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import {
  ProcurementServiceProxy,
  ReorderRunView,
} from '../../../../shared/service-proxies/service-proxies';

/**
 * Auto-reorder: scan every stock level below its reorder point and raise
 * draft purchase orders to a preferred supplier, one per supplier×warehouse.
 * The run reports what it created and what it had to skip, and why.
 */
@Component({
  selector: 'app-reorder-page',
  imports: [RouterLink, NgIcon, UiButton, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reorder.page.html',
})
export class ReorderPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  readonly canRun = computed(() => this.auth.hasPermission(Permissions.ordersCreate));

  readonly running = signal(false);
  readonly result = signal<ReorderRunView | null>(null);

  run(): void {
    if (this.running()) return;
    this.running.set(true);
    this.proxy.run_reorder().subscribe({
      next: (r) => {
        this.running.set(false);
        this.result.set(r);
        const n = r.orders?.length ?? 0;
        this.notify.success(
          n ? `Created ${n} draft order${n === 1 ? '' : 's'}` : 'Nothing to reorder',
        );
      },
      error: (err) => {
        this.running.set(false);
        this.notify.error(apiErrorInfo(err).message || 'The reorder run failed.');
      },
    });
  }
}
