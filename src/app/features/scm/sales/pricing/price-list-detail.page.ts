import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { PageSkeleton } from '../../../../shared/ui/skeleton';
import { Lookup } from '../../../../shared/lookup/lookup';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { fmtCost, priceListStatusTones, statusLabel } from '../../shared/scm-format';
import { itemLookup } from '../../shared/scm-lookups';
import {
  InventoryItem,
  InventoryServiceProxy,
  PriceLineBody,
  PriceLinesBody,
  SalesPriceList,
  SalesPriceListItem,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

interface PriceRow {
  item_id: string;
  item_label: string;
  min_qty: string;
  unit_price: string;
  discount_pct: string;
}

/** One price list: its header, activation lifecycle and editable item prices. */
@Component({
  selector: 'app-price-list-detail-page',
  imports: [PageSkeleton, FormsModule, RouterLink, NgIcon, UiButton, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-list-detail.page.html',
})
export class PriceListDetailPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly inventory = inject(InventoryServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canManage = computed(() => this.auth.hasPermission(Permissions.pricingManage));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly savingLines = signal(false);
  readonly list = signal<SalesPriceList | null>(null);
  readonly rows = signal<PriceRow[]>([]);

  readonly tones = priceListStatusTones;
  readonly itemLookup = itemLookup(this.inventory, (i) => i.is_sellable);

  readonly statusLabel = statusLabel;
  readonly fmtCost = fmtCost;

  private id = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.id = params.get('id') ?? '';
      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.proxy.get_list(this.id).subscribe({
      next: (l) => {
        this.list.set(l);
        this.loading.set(false);
        this.loadLines();
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the price list.');
        this.loading.set(false);
      },
    });
  }

  private loadLines(): void {
    this.proxy.get_lines(this.id).subscribe({
      next: (items) => {
        this.rows.set((items ?? []).map((i) => this.toRow(i)));
        this.resolveLabels();
      },
      error: () => this.rows.set([]),
    });
  }

  /** Fill in item labels for the loaded rows (get_lines returns only ids). */
  private resolveLabels(): void {
    if (this.rows().every((r) => !r.item_id || r.item_label)) return;
    this.inventory.list_items(null, null, null).subscribe({
      next: (all) => {
        const byId = new Map((all ?? []).map((i) => [i.id, `${i.sku} — ${i.name}`]));
        this.rows.update((rs) =>
          rs.map((r) => ({ ...r, item_label: r.item_label || byId.get(r.item_id) || '' })),
        );
      },
      error: () => {},
    });
  }

  private toRow(i: SalesPriceListItem): PriceRow {
    return {
      item_id: i.item_id,
      item_label: '',
      min_qty: i.min_qty ?? '1',
      unit_price: i.unit_price ?? '',
      discount_pct: i.discount_pct ?? '',
    };
  }

  private blank(): PriceRow {
    return { item_id: '', item_label: '', min_qty: '1', unit_price: '', discount_pct: '' };
  }

  addRow(): void {
    this.rows.update((rs) => [...rs, this.blank()]);
  }

  removeRow(i: number): void {
    this.rows.update((rs) => rs.filter((_, idx) => idx !== i));
  }

  onItemSelected(row: PriceRow, item: InventoryItem): void {
    row.item_id = item.id;
    row.item_label = `${item.sku} — ${item.name}`;
    this.rows.update((rs) => [...rs]);
  }

  onItemValue(row: PriceRow, value: string | null): void {
    row.item_id = value ?? '';
    if (!value) row.item_label = '';
    this.rows.update((rs) => [...rs]);
  }

  saveLines(): void {
    if (this.savingLines()) return;
    const lines: PriceLineBody[] = [];
    for (const r of this.rows()) {
      if (!r.item_id) continue;
      if (!r.unit_price.trim() && !r.discount_pct.trim()) {
        this.notify.error('Each line needs a unit price or a discount %.');
        return;
      }
      lines.push({
        item_id: r.item_id,
        min_qty: r.min_qty.trim() ? Number(r.min_qty).toString() : undefined,
        unit_price: r.unit_price.trim() ? Number(r.unit_price).toString() : undefined,
        discount_pct: r.discount_pct.trim() ? Number(r.discount_pct).toString() : undefined,
      });
    }
    const body: PriceLinesBody = { lines };
    this.savingLines.set(true);
    this.proxy.put_lines(this.id, body).subscribe({
      next: (items) => {
        this.savingLines.set(false);
        this.rows.set((items ?? []).map((i) => this.toRow(i)));
        this.loadLines();
        this.notify.success('Prices saved');
      },
      error: (err) => {
        this.savingLines.set(false);
        this.notify.error('Could not save prices', apiErrorInfo(err).message);
      },
    });
  }

  activate(): void {
    this.run(this.proxy.activate_list(this.id), 'Price list activated');
  }

  archive(): void {
    this.run(this.proxy.archive_list(this.id), 'Price list archived');
  }

  edit(): void {
    void this.router.navigate(['/sales/price-lists', this.id, 'edit']);
  }

  private run(op$: import('rxjs').Observable<SalesPriceList>, msg: string): void {
    this.busy.set(true);
    op$.subscribe({
      next: (l) => {
        this.busy.set(false);
        this.list.set(l);
        this.notify.success(msg);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'The action failed.');
      },
    });
  }
}
