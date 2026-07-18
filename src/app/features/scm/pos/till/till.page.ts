import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBanknote,
  lucideCheck,
  lucideChevronLeft,
  lucideCircleCheck,
  lucideCreditCard,
  lucideDelete,
  lucideHandCoins,
  lucideLogOut,
  lucideMinus,
  lucideMonitor,
  lucidePause,
  lucidePlay,
  lucidePlus,
  lucideReceipt,
  lucideScanBarcode,
  lucideSearch,
  lucideShoppingCart,
  lucideSmartphone,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { Modal } from '../../../../shared/ui/modal';
import { UiButton } from '../../../../shared/ui/button';
import { fmtDateTime, fmtMoney, fmtQty, num } from '../../shared/scm-format';
import { TENDERS, sheetTotal, suggestSheet, tenderLabel } from '../shared/pos-format';
import { CartLine, TillStore } from './till-store';
import {
  DenominationCount,
  SessionReport,
  SessionView,
} from '../../../../shared/service-proxies/service-proxies';

/** A count row in the close wizard. */
interface CloseRow {
  tender: string;
  expected: number | null;
  counted: string;
}

/**
 * The counter itself — a full-screen page outside the app shell, laid out per
 * the POS UX spec (pylonImlementation/pos/02-ui-ux-research.md): cart on the
 * left, catalog with an always-focused search bar on the right, the tender
 * screen replacing the catalog while the cart stays visible, and session
 * open/close as guided screens inside the till rather than admin forms.
 *
 * Online-first v1: every sale goes straight to `POST /pos/sales` (the offline
 * queue is the PWA phase). Held carts survive a refresh via localStorage.
 */
@Component({
  selector: 'app-till-page',
  imports: [FormsModule, RouterLink, NgIcon, UiButton, Modal],
  providers: [
    TillStore,
    provideIcons({
      lucideBanknote,
      lucideCheck,
      lucideChevronLeft,
      lucideCircleCheck,
      lucideCreditCard,
      lucideDelete,
      lucideHandCoins,
      lucideLogOut,
      lucideMinus,
      lucideMonitor,
      lucidePause,
      lucidePlay,
      lucidePlus,
      lucideReceipt,
      lucideScanBarcode,
      lucideSearch,
      lucideShoppingCart,
      lucideSmartphone,
      lucideTrash2,
      lucideX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './till.page.html',
})
export class TillPage {
  readonly store = inject(TillStore);
  private readonly auth = inject(AuthService);

  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');

  readonly canClose = computed(() => this.auth.hasPermission(Permissions.posSessionsClose));
  readonly canPaidInOut = computed(() =>
    this.auth.hasPermission(Permissions.posSessionsPaidInOut),
  );
  readonly canOpen = computed(() => this.auth.hasPermission(Permissions.posSessionsOpen));

  readonly fmtMoney = fmtMoney;
  readonly fmtQty = fmtQty;
  readonly fmtDateTime = fmtDateTime;
  readonly tenderLabel = tenderLabel;
  readonly tenders = TENDERS;
  readonly num = num;

  // --- open screen ---
  openingFloat = '';

  // --- tender screen ---
  activeTender = 'cash';
  amountInput = '';
  tenderedInput = '';
  referenceInput = '';

  // --- menu + modals over the sell screen ---
  readonly menuOpen = signal(false);
  readonly xModal = signal(false);
  readonly xReport = signal<SessionReport | null>(null);
  readonly movementModal = signal(false);
  movementKind: 'paid_in' | 'paid_out' = 'paid_out';
  movementAmount = '';
  movementReason = '';

  // --- close wizard ---
  readonly closeRows = signal<CloseRow[]>([]);
  readonly closeBlind = signal(false);
  readonly useSheet = signal(true);
  readonly sheet = signal<Array<{ denom: string; count: number | null }>>([]);
  closeNote = '';
  readonly closedResult = signal<SessionView | null>(null);
  private lastCloseCounts: Array<{
    tender: string;
    counted: number;
    sheet?: DenominationCount[];
  }> | null = null;

  /** The wall clock in the session bar — a till shows the time. */
  readonly clock = signal(this.timeNow());

  constructor() {
    this.store.init();
    const tick = setInterval(() => this.clock.set(this.timeNow()), 15_000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }

  private timeNow(): string {
    return new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  /** A deterministic tile accent per item, so the grid reads by colour and
   * position — spatial memory is the whole point of a stable grid. */
  tileStyle(name: string): Record<string, string> {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return {
      'background-color': `hsl(${h} 70% 50% / 0.14)`,
      color: `hsl(${h} 60% 38%)`,
    };
  }

  itemCount(): number {
    return this.store.cart().reduce((n, l) => n + l.qty, 0);
  }

  // ---------------------------------------------------------------------------
  // Numpad: the tender screen's keys, writing into the active amount
  // ---------------------------------------------------------------------------

  padPress(key: string): void {
    const current = this.activeTender === 'cash' ? this.tenderedInput : this.amountInput;
    let next = current;
    if (key === 'back') next = current.slice(0, -1);
    else if (key === '.') next = current.includes('.') ? current : (current || '0') + '.';
    else next = (current === '0' ? '' : current) + key;
    if (this.activeTender === 'cash') this.tenderedInput = next;
    else this.amountInput = next;
  }

  padTake(): void {
    if (this.activeTender === 'cash') this.takeCash(num(this.tenderedInput));
    else this.addTenderEntry();
  }

  tenderTileClass(tender: string): string {
    return this.activeTender === tender ? 'border-primary bg-primary/5' : 'border-border';
  }

  // ---------------------------------------------------------------------------
  // Keyboard: `/` finds the search bar, F2 charges, Esc walks back.
  // ---------------------------------------------------------------------------

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    const screen = this.store.screen();
    if (event.key === '/' && screen === 'sell') {
      const box = this.searchBox()?.nativeElement;
      if (box && document.activeElement !== box) {
        event.preventDefault();
        box.focus();
      }
    } else if (event.key === 'F2' && screen === 'sell') {
      event.preventDefault();
      this.store.charge();
    } else if (event.key === 'Escape') {
      if (screen === 'tender') this.store.backToSelling();
      else if (screen === 'done') this.store.newSale();
    } else if (event.key === 'Enter' && screen === 'done') {
      this.store.newSale();
    }
  }

  onSearchEnter(): void {
    this.store.addBySearch(this.store.search());
  }

  lineTotal(line: CartLine): number {
    return (Math.round(num(line.item.price) * 100) * line.qty) / 100;
  }

  /** The tile's stock badge: quiet when plenty, amber when low, red when out. */
  stockBadgeClass(onHand: string): string {
    const n = num(onHand);
    if (n <= 0) return 'bg-destructive/10 text-destructive';
    if (n <= 5) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    return 'bg-muted text-muted-foreground';
  }

  // ---------------------------------------------------------------------------
  // Tender screen
  // ---------------------------------------------------------------------------

  pickTender(tender: string): void {
    this.activeTender = tender;
    this.amountInput = this.store.remaining() > 0 ? this.store.remaining().toFixed(2) : '';
    this.tenderedInput = '';
    this.referenceInput = '';
  }

  /** Exact, then the next round notes up — the cash amounts a hand actually offers. */
  cashSuggestions(): number[] {
    const due = this.store.remaining();
    if (due <= 0) return [];
    const ups = [50, 100, 200, 500, 1000, 2000]
      .map((step) => Math.ceil(due / step) * step)
      .filter((v) => v > due);
    return [due, ...[...new Set(ups)].slice(0, 3)];
  }

  takeCash(tendered: number): void {
    const due = this.store.remaining();
    if (due <= 0) return;
    this.store.addTender('cash', Math.min(due, tendered), tendered);
  }

  addTenderEntry(): void {
    const amount = num(this.amountInput);
    if (this.activeTender === 'cash') {
      const tendered = this.tenderedInput ? num(this.tenderedInput) : amount;
      this.store.addTender('cash', Math.min(amount, this.store.remaining()), tendered);
    } else {
      this.store.addTender(
        this.activeTender,
        amount,
        undefined,
        this.referenceInput.trim() || undefined,
      );
    }
    this.amountInput = this.store.remaining() > 0 ? this.store.remaining().toFixed(2) : '';
    this.tenderedInput = '';
    this.referenceInput = '';
  }

  // ---------------------------------------------------------------------------
  // Session acts
  // ---------------------------------------------------------------------------

  showX(): void {
    this.menuOpen.set(false);
    this.store.xReport((report) => {
      this.xReport.set(report);
      this.xModal.set(true);
    });
  }

  openMovement(): void {
    this.menuOpen.set(false);
    this.movementKind = 'paid_out';
    this.movementAmount = '';
    this.movementReason = '';
    this.movementModal.set(true);
  }

  saveMovement(): void {
    this.store.cashMovement(this.movementKind, this.movementAmount, this.movementReason, () =>
      this.movementModal.set(false),
    );
  }

  /** Step into the close: the X decides which tenders there are to count. */
  startClose(): void {
    this.menuOpen.set(false);
    this.store.xReport((report) => {
      this.closeBlind.set(report.blind);
      const rows: CloseRow[] = [];
      // Cash is always counted — even when the X withholds its expectation.
      const cashLine = report.tenders.find((t) => t.tender === 'cash');
      rows.push({
        tender: 'cash',
        expected: report.blind ? null : num(cashLine?.expected ?? report.expected_cash ?? 0),
        counted: '',
      });
      for (const t of report.tenders) {
        if (t.tender === 'cash') continue;
        // Clearing tenders come from records — prefill, still correctable.
        rows.push({ tender: t.tender, expected: num(t.expected), counted: t.expected });
      }
      this.closeRows.set(rows);
      const denoms = this.store.settings()?.denominations ?? [];
      this.useSheet.set(denoms.length > 0);
      this.sheet.set(denoms.map((d) => ({ denom: d, count: null })));
      this.closeNote = '';
      this.closedResult.set(null);
      this.lastCloseCounts = null;
      this.store.screen.set('close');
    });
  }

  sheetSum(): number {
    return sheetTotal(
      this.sheet().map((r) => ({ denom: r.denom, count: r.count ?? 0 })),
    );
  }

  /** Greedy-fill the sheet from the expectation — a starting point to correct,
   * only offered when the count is not blind. */
  prefillSheet(): void {
    const expected = this.closeRows().find((r) => r.tender === 'cash')?.expected;
    if (expected == null) return;
    const filled = suggestSheet(expected, this.sheet().map((r) => r.denom));
    this.sheet.update((rows) =>
      rows.map((r) => ({
        denom: r.denom,
        count: filled.find((f) => f.denom === r.denom)?.count ?? null,
      })),
    );
  }

  /** The sheet total becomes the cash count — one source of truth at a time. */
  cashCounted(): number {
    if (this.useSheet() && this.sheet().length) return this.sheetSum();
    return num(this.closeRows().find((r) => r.tender === 'cash')?.counted);
  }

  rowVariance(row: CloseRow): number | null {
    if (row.expected == null) return null;
    const counted = row.tender === 'cash' ? this.cashCounted() : num(row.counted);
    return Math.round((counted - row.expected) * 100) / 100;
  }

  varianceNonzero(): boolean {
    return this.closeRows().some((r) => {
      const v = this.rowVariance(r);
      return v != null && Math.abs(v) > 0.0001;
    });
  }

  confirmClose(): void {
    const counts = this.closeRows().map((row) => {
      if (row.tender === 'cash') {
        const useSheet = this.useSheet() && this.sheet().length > 0;
        return {
          tender: 'cash',
          counted: this.cashCounted(),
          sheet: useSheet
            ? this.sheet()
                .filter((r) => (r.count ?? 0) > 0)
                .map(
                  (r): DenominationCount => ({ denom: r.denom, count: r.count ?? 0 }),
                )
            : undefined,
        };
      }
      return { tender: row.tender, counted: num(row.counted) };
    });
    this.lastCloseCounts = counts;
    this.store.closeSession(counts, this.closeNote, (session) => {
      this.closedResult.set(session);
    });
  }

  retryClose(): void {
    if (!this.lastCloseCounts) return;
    this.store.closeSession(this.lastCloseCounts, this.closeNote, (session) => {
      this.closedResult.set(session);
    });
  }

  abandonClose(): void {
    this.closedResult.set(null);
    this.store.screen.set('sell');
  }

  /** After a clean close: back to the open screen for the next shift. */
  nextShift(): void {
    this.closedResult.set(null);
    this.store.session.set(null);
    this.openingFloat = '';
    this.store.screen.set('open');
  }
}
