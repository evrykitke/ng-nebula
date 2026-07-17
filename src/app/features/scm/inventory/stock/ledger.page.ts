import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DateTime } from 'luxon';
import { UiButton } from '../../../../shared/ui/button';
import { UiDatepicker } from '../../../../shared/ui/datepicker';
import { Spinner } from '../../../../shared/ui/skeleton';
import { Lookup } from '../../../../shared/lookup/lookup';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { asDateString, fmtCost, fmtDate, fmtMoney, fmtQty } from '../../shared/scm-format';
import { itemLookup } from '../../shared/scm-lookups';
import {
  InventoryServiceProxy,
  InventoryWarehouse,
  LedgerRowView,
} from '../../../../shared/service-proxies/service-proxies';

const PAGE = 100;

/**
 * The immutable stock ledger — every posted quantity/value delta in
 * sequence. Filter by item, warehouse and date; pages forward by sequence
 * number (the backend cursor).
 */
@Component({
  selector: 'app-stock-ledger-page',
  imports: [FormsModule, RouterLink, UiButton, UiDatepicker, Spinner, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ledger.page.html',
})
export class StockLedgerPage {
  private readonly proxy = inject(InventoryServiceProxy);
  private readonly notify = inject(NotificationService);

  readonly warehouses = signal<InventoryWarehouse[]>([]);
  readonly rows = signal<LedgerRowView[]>([]);
  readonly loading = signal(false);
  readonly hasMore = signal(false);

  readonly itemLookup = itemLookup(this.proxy);

  filters = {
    item_id: '',
    item_label: '',
    warehouse_id: '',
    from: undefined as DateTime | undefined,
    to: undefined as DateTime | undefined,
  };

  readonly fmtQty = fmtQty;
  readonly fmtMoney = fmtMoney;
  readonly fmtCost = fmtCost;
  readonly fmtDate = fmtDate;

  constructor() {
    this.proxy.list_warehouses().subscribe({
      next: (all) => this.warehouses.set(all ?? []),
      error: () => {},
    });
    this.load();
  }

  load(): void {
    this.rows.set([]);
    this.fetch(null);
  }

  loadMore(): void {
    const last = this.rows().at(-1);
    this.fetch(last ? last.seq : null);
  }

  private fetch(afterSeq: number | null): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.proxy
      .list_ledger(
        this.filters.item_id || null,
        this.filters.warehouse_id || null,
        this.filters.from ? asDateString(this.filters.from) : null,
        this.filters.to ? asDateString(this.filters.to) : null,
        afterSeq,
        PAGE,
      )
      .subscribe({
        next: (page) => {
          const rows = page ?? [];
          this.rows.update((cur) => [...cur, ...rows]);
          this.hasMore.set(rows.length === PAGE);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.notify.error('Could not load the ledger', apiErrorInfo(err).message);
        },
      });
  }
}
