import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { fmtMoney, fmtQty, num } from '../../shared/scm-format';
import { GrniRow, ProcurementServiceProxy } from '../../../../shared/service-proxies/service-proxies';

/** One purchase order's open GRNI position, its lines grouped together. */
interface OrderGroup {
  order_id: string;
  order_number: string;
  supplier_name: string;
  rows: GrniRow[];
  total: number;
}

/**
 * Goods received, not invoiced: every order line where more has been
 * received than billed, grouped by purchase order with a Bill action that
 * opens a supplier invoice prefilled for that order.
 */
@Component({
  selector: 'app-grni-page',
  imports: [RouterLink, NgIcon, UiButton, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grni.page.html',
})
export class GrniPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  readonly canBill = computed(() => this.auth.hasPermission(Permissions.purchaseInvoicesCreate));

  readonly loading = signal(true);
  readonly rows = signal<GrniRow[]>([]);
  readonly total = signal(0);

  readonly fmtMoney = fmtMoney;
  readonly fmtQty = fmtQty;

  /** GRNI lines grouped by their purchase order, largest exposure first. */
  readonly groups = computed<OrderGroup[]>(() => {
    const byOrder = new Map<string, OrderGroup>();
    for (const r of this.rows()) {
      let g = byOrder.get(r.order_id);
      if (!g) {
        g = {
          order_id: r.order_id,
          order_number: r.order_number ?? '(draft)',
          supplier_name: r.supplier_name,
          rows: [],
          total: 0,
        };
        byOrder.set(r.order_id, g);
      }
      g.rows.push(r);
      g.total += num(r.value);
    }
    return [...byOrder.values()].sort((a, b) => b.total - a.total);
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.proxy.grni_json().subscribe({
      next: (v) => {
        this.rows.set(v.rows ?? []);
        this.total.set(num(v.total));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load GRNI', apiErrorInfo(err).message);
      },
    });
  }
}
