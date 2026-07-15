import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import {
  fmtCost,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  fmtQty,
  serialStatusTones,
  statusLabel,
} from '../../shared/scm-format';
import {
  BatchLevelView,
  InventoryCategory,
  InventoryItem,
  InventorySerial,
  InventoryServiceProxy,
  InventoryUom,
  LedgerRowView,
  LevelView,
} from '../../../../shared/service-proxies/service-proxies';

type Tab = 'stock' | 'batches' | 'serials' | 'history';

/**
 * One item, fully unfolded: master data, per-warehouse stock position, its
 * lots and serial units, and the recent ledger history.
 */
@Component({
  selector: 'app-item-detail-page',
  imports: [RouterLink, NgIcon, UiButton, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item-detail.page.html',
})
export class ItemDetailPage {
  private readonly proxy = inject(InventoryServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canEdit = computed(() => this.auth.hasPermission(Permissions.itemsEdit));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly item = signal<InventoryItem | null>(null);
  readonly tab = signal<Tab>('stock');

  readonly levels = signal<LevelView[]>([]);
  readonly batches = signal<BatchLevelView[]>([]);
  readonly serials = signal<InventorySerial[]>([]);
  readonly ledger = signal<LedgerRowView[]>([]);

  private readonly categories = signal<InventoryCategory[]>([]);
  private readonly uoms = signal<InventoryUom[]>([]);
  private readonly warehouseNames = signal<Map<string, string>>(new Map());

  readonly categoryName = computed(() => {
    const id = this.item()?.category_id;
    return id ? (this.categories().find((c) => c.id === id)?.name ?? '—') : '—';
  });
  readonly uomCode = computed(() => {
    const id = this.item()?.uom_id;
    return id ? (this.uoms().find((u) => u.id === id)?.code ?? '—') : '—';
  });

  readonly totals = computed(() => {
    let onHand = 0;
    let available = 0;
    let value = 0;
    for (const l of this.levels()) {
      onHand += Number(l.on_hand) || 0;
      available += Number(l.available) || 0;
      value += Number(l.value) || 0;
    }
    return { onHand, available, value };
  });

  readonly tabs = computed<Tab[]>(() => {
    const i = this.item();
    const out: Tab[] = ['stock'];
    if (i?.track_batches) out.push('batches');
    if (i?.track_serials) out.push('serials');
    out.push('history');
    return out;
  });

  private id = '';

  readonly fmtQty = fmtQty;
  readonly fmtMoney = fmtMoney;
  readonly fmtCost = fmtCost;
  readonly fmtDate = fmtDate;
  readonly fmtDateTime = fmtDateTime;
  readonly statusLabel = statusLabel;
  readonly serialTones = serialStatusTones;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.id = params.get('id') ?? '';
      this.load();
    });

    this.proxy.list_categories().subscribe({
      next: (all) => this.categories.set(all ?? []),
      error: () => {},
    });
    this.proxy.list_uoms().subscribe({
      next: (all) => this.uoms.set(all ?? []),
      error: () => {},
    });
    this.proxy.list_warehouses().subscribe({
      next: (all) =>
        this.warehouseNames.set(new Map((all ?? []).map((w) => [w.id, `${w.code} — ${w.name}`]))),
      error: () => {},
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.proxy.get_item(this.id).subscribe({
      next: (i) => {
        this.item.set(i);
        this.loading.set(false);
        this.loadStock(i);
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the item.');
        this.loading.set(false);
      },
    });
  }

  private loadStock(i: InventoryItem): void {
    this.proxy.list_levels(null, i.id, false).subscribe({
      next: (rows) => this.levels.set(rows ?? []),
      error: () => {},
    });
    this.proxy.list_ledger(i.id, null, null, null, null, 50).subscribe({
      next: (rows) => this.ledger.set(rows ?? []),
      error: () => {},
    });
    if (i.track_batches) {
      this.proxy.item_batches(i.id, null, false).subscribe({
        next: (rows) => this.batches.set(rows ?? []),
        error: () => {},
      });
    }
    if (i.track_serials) {
      this.proxy.item_serials(i.id, null, null).subscribe({
        next: (rows) => this.serials.set(rows ?? []),
        error: () => {},
      });
    }
  }

  warehouseName(id: string | undefined): string {
    return id ? (this.warehouseNames().get(id) ?? '—') : '—';
  }

  tabLabel(t: Tab): string {
    return t === 'stock'
      ? 'Stock'
      : t === 'batches'
        ? 'Batches'
        : t === 'serials'
          ? 'Serials'
          : 'History';
  }

  serialToneClass(status: string): string {
    const tone = this.serialTones[status] ?? 'muted';
    return tone === 'success'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : tone === 'info'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        : tone === 'danger'
          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          : 'bg-muted text-muted-foreground';
  }

  edit(): void {
    void this.router.navigate(['/inventory/items', this.id, 'edit']);
  }
}
