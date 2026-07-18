import { Injectable, computed, inject, signal } from '@angular/core';
import { DateTime } from 'luxon';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { num } from '../../shared/scm-format';
import {
  CatalogItem,
  DenominationCount,
  PosOrderView,
  PosRegister,
  PosServiceProxy,
  SessionCountRequest,
  SessionReport,
  SessionView,
  Settings,
} from '../../../../shared/service-proxies/service-proxies';

/** One line in the cart. `uid` keys the row — the same item may appear twice
 * with different batches. */
export interface CartLine {
  uid: number;
  item: CatalogItem;
  qty: number;
  batchId?: string;
}

/** One tender the cashier has taken toward the current sale. */
export interface TenderEntry {
  tender: string;
  amount: number;
  tendered?: number;
  reference?: string;
}

/** A parked cart, waiting for the customer to come back. */
interface ParkedCart {
  at: string;
  lines: Array<{ itemId: string; qty: number; batchId?: string }>;
}

export type TillScreen = 'boot' | 'pick' | 'open' | 'sell' | 'tender' | 'done' | 'close';

/** All money in integer cents — the drawer never holds 0.30000000000000004. */
const cents = (v: string | number | null | undefined): number => Math.round(num(v) * 100);

/**
 * The till's whole state, one injectable owned by the till page: which
 * register, which session, the cached catalog, the cart, and the sale-capture
 * instrumentation the backend aggregates per session (seconds and inputs per
 * sale). Screens are a signal, not routes — the counter never navigates.
 */
@Injectable()
export class TillStore {
  private readonly proxy = inject(PosServiceProxy);
  private readonly notify = inject(NotificationService);

  readonly screen = signal<TillScreen>('boot');
  readonly busy = signal(false);

  readonly registers = signal<PosRegister[]>([]);
  readonly register = signal<PosRegister | null>(null);
  readonly session = signal<SessionView | null>(null);
  readonly settings = signal<Settings | null>(null);

  readonly catalog = signal<CatalogItem[]>([]);
  readonly currency = signal('');
  readonly search = signal('');

  readonly cart = signal<CartLine[]>([]);
  readonly selected = signal<number | null>(null);
  readonly tenders = signal<TenderEntry[]>([]);
  readonly lastReceipt = signal<PosOrderView | null>(null);
  readonly parked = signal<ParkedCart[]>([]);

  // --- instrumentation: what this sale cost the cashier ---
  private firstInputAt: number | null = null;
  private inputCount = 0;
  private nextUid = 1;

  readonly filtered = computed(() => {
    const s = this.search().trim().toLowerCase();
    const items = this.catalog();
    if (!s) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(s) ||
        i.sku.toLowerCase().includes(s) ||
        (i.barcode ?? '').toLowerCase().includes(s),
    );
  });

  readonly totalCents = computed(() =>
    this.cart().reduce((n, l) => n + cents(l.item.price) * l.qty, 0),
  );
  readonly total = computed(() => this.totalCents() / 100);
  /** The VAT inside the total, from the cached rates — provisional; the server recomputes. */
  readonly taxTotal = computed(
    () =>
      this.cart().reduce((n, l) => {
        const r = num(l.item.tax_rate);
        const line = cents(l.item.price) * l.qty;
        return n + (r > 0 ? Math.round((line * r) / (100 + r)) : 0);
      }, 0) / 100,
  );

  readonly tenderedCents = computed(() =>
    this.tenders().reduce((n, t) => n + Math.round(t.amount * 100), 0),
  );
  readonly remaining = computed(() => (this.totalCents() - this.tenderedCents()) / 100);
  readonly changeDue = computed(
    () =>
      this.tenders().reduce(
        (n, t) =>
          t.tender === 'cash' && t.tendered
            ? n + Math.max(0, Math.round(t.tendered * 100) - Math.round(t.amount * 100))
            : n,
        0,
      ) / 100,
  );

  // -------------------------------------------------------------------------
  // Boot: registers → remembered register → its open session → the catalog
  // -------------------------------------------------------------------------

  init(): void {
    this.screen.set('boot');
    this.proxy.get_settings().subscribe({
      next: (s) => this.settings.set(s),
      error: () => this.settings.set(null),
    });
    this.proxy.list_registers().subscribe({
      next: (regs) => {
        const active = (regs ?? []).filter((r) => r.is_active);
        this.registers.set(active);
        const rememberedId = localStorage.getItem('pos.register');
        const remembered = active.find((r) => r.id === rememberedId);
        if (remembered) this.pickRegister(remembered);
        else if (active.length === 1) this.pickRegister(active[0]);
        else this.screen.set('pick');
      },
      error: (err) => {
        this.notify.error('Could not load registers', apiErrorInfo(err).message);
        this.screen.set('pick');
      },
    });
  }

  pickRegister(register: PosRegister): void {
    this.register.set(register);
    localStorage.setItem('pos.register', register.id);
    this.restoreParked();
    this.proxy.current_session(register.id).subscribe({
      next: (session) => {
        if (session && session.status === 'open') {
          this.session.set(session);
          this.enterSelling();
        } else {
          this.session.set(null);
          this.screen.set('open');
        }
      },
      error: (err) => {
        this.notify.error('Could not check the register', apiErrorInfo(err).message);
        this.screen.set('pick');
      },
    });
  }

  changeRegister(): void {
    this.register.set(null);
    this.session.set(null);
    localStorage.removeItem('pos.register');
    this.screen.set('pick');
  }

  openSession(openingFloat: string): void {
    const register = this.register();
    if (!register || this.busy()) return;
    if (num(openingFloat) < 0) {
      this.notify.error('The float cannot be negative.');
      return;
    }
    this.busy.set(true);
    this.proxy
      .open_session({ register_id: register.id, opening_float: String(num(openingFloat)) })
      .subscribe({
        next: (session) => {
          this.busy.set(false);
          this.session.set(session);
          this.enterSelling();
        },
        error: (err) => {
          this.busy.set(false);
          this.notify.error(apiErrorInfo(err).message || 'Could not open the session.');
        },
      });
  }

  private enterSelling(): void {
    this.screen.set('sell');
    this.loadCatalog();
  }

  loadCatalog(): void {
    const register = this.register();
    if (!register) return;
    this.proxy.get_catalog(register.id, null).subscribe({
      next: (view) => {
        this.catalog.set(
          [...view.items].sort((a, b) => a.name.localeCompare(b.name)),
        );
        this.currency.set(view.currency);
      },
      error: (err) => {
        this.notify.error('Could not load the catalog', apiErrorInfo(err).message);
      },
    });
  }

  // -------------------------------------------------------------------------
  // The cart
  // -------------------------------------------------------------------------

  private touch(): void {
    this.firstInputAt ??= Date.now();
    this.inputCount += 1;
  }

  addItem(item: CatalogItem): void {
    if (item.track_batches && !item.batches.length) {
      this.notify.error(`${item.name} has no batch in stock.`);
      return;
    }
    this.touch();
    // FEFO: the catalog sorts batches first-expiry-first; take the head.
    const batchId = item.track_batches ? item.batches[0].id : undefined;
    const existing = this.cart().find((l) => l.item.id === item.id && l.batchId === batchId);
    if (existing) {
      this.setQty(existing.uid, existing.qty + 1);
      return;
    }
    const line: CartLine = { uid: this.nextUid++, item, qty: 1, batchId };
    this.cart.update((lines) => [...lines, line]);
    this.selected.set(line.uid);
  }

  setQty(uid: number, qty: number): void {
    const line = this.cart().find((l) => l.uid === uid);
    if (!line) return;
    const whole = !line.item.uom_fractional;
    const next = whole ? Math.round(qty) : qty;
    if (next <= 0) {
      this.removeLine(uid);
      return;
    }
    this.touch();
    this.cart.update((lines) => lines.map((l) => (l.uid === uid ? { ...l, qty: next } : l)));
  }

  bumpQty(uid: number, delta: number): void {
    const line = this.cart().find((l) => l.uid === uid);
    if (line) this.setQty(uid, line.qty + delta);
  }

  removeLine(uid: number): void {
    this.touch();
    this.cart.update((lines) => lines.filter((l) => l.uid !== uid));
    if (this.selected() === uid) this.selected.set(null);
  }

  clearCart(): void {
    this.cart.set([]);
    this.selected.set(null);
    this.tenders.set([]);
    this.firstInputAt = null;
    this.inputCount = 0;
  }

  /** Add by barcode / sku / first match — the wedge path. */
  addBySearch(term: string): boolean {
    const s = term.trim().toLowerCase();
    if (!s) return false;
    const items = this.catalog();
    const hit =
      items.find((i) => (i.barcode ?? '').toLowerCase() === s) ??
      items.find((i) => i.sku.toLowerCase() === s) ??
      this.filtered()[0];
    if (!hit) return false;
    this.addItem(hit);
    this.search.set('');
    return true;
  }

  // --- parked carts (localStorage — survives a refresh, per register) ---

  private parkedKey(): string {
    return `pos.parked.${this.register()?.id ?? ''}`;
  }

  private restoreParked(): void {
    try {
      this.parked.set(JSON.parse(localStorage.getItem(this.parkedKey()) ?? '[]'));
    } catch {
      this.parked.set([]);
    }
  }

  private persistParked(): void {
    localStorage.setItem(this.parkedKey(), JSON.stringify(this.parked()));
  }

  park(): void {
    const lines = this.cart();
    if (!lines.length) return;
    this.parked.update((p) => [
      ...p,
      {
        at: new Date().toISOString(),
        lines: lines.map((l) => ({ itemId: l.item.id, qty: l.qty, batchId: l.batchId })),
      },
    ]);
    this.persistParked();
    this.clearCart();
  }

  resume(index: number): void {
    const parked = this.parked()[index];
    if (!parked || this.cart().length) return;
    const items = this.catalog();
    const lines: CartLine[] = [];
    for (const saved of parked.lines) {
      const item = items.find((i) => i.id === saved.itemId);
      if (item) lines.push({ uid: this.nextUid++, item, qty: saved.qty, batchId: saved.batchId });
    }
    this.cart.set(lines);
    this.parked.update((p) => p.filter((_, i) => i !== index));
    this.persistParked();
  }

  // -------------------------------------------------------------------------
  // Tender and capture
  // -------------------------------------------------------------------------

  charge(): void {
    if (!this.cart().length) {
      this.notify.error('The cart is empty — add something to sell.');
      return;
    }
    this.tenders.set([]);
    this.screen.set('tender');
  }

  backToSelling(): void {
    this.tenders.set([]);
    this.screen.set('sell');
  }

  addTender(tender: string, amount: number, tendered?: number, reference?: string): void {
    if (amount <= 0) {
      this.notify.error('The amount must be positive.');
      return;
    }
    this.touch();
    this.tenders.update((list) => [...list, { tender, amount, tendered, reference }]);
  }

  removeTender(index: number): void {
    this.tenders.update((list) => list.filter((_, i) => i !== index));
  }

  confirmSale(): void {
    const session = this.session();
    if (!session || this.busy()) return;
    if (Math.abs(this.remaining()) > 0.0001) {
      this.notify.error('The tenders do not cover the total yet.');
      return;
    }
    const seconds = this.firstInputAt
      ? Math.max(1, Math.round((Date.now() - this.firstInputAt) / 1000))
      : undefined;
    this.busy.set(true);
    this.proxy
      .capture_sale({
        client_uuid: crypto.randomUUID(),
        session_id: session.id,
        sold_at: DateTime.utc(),
        capture_seconds: seconds,
        input_count: this.inputCount || undefined,
        lines: this.cart().map((l) => ({
          item_id: l.item.id,
          qty: String(l.qty),
          unit_price: l.item.price,
          batch_id: l.batchId,
        })),
        tenders: this.tenders().map((t) => ({
          tender: t.tender,
          amount: t.amount.toFixed(2),
          tendered: t.tendered != null ? t.tendered.toFixed(2) : undefined,
          reference: t.reference || undefined,
        })),
      })
      .subscribe({
        next: (order) => {
          this.busy.set(false);
          this.lastReceipt.set(order);
          this.clearCart();
          this.screen.set('done');
        },
        error: (err) => {
          this.busy.set(false);
          this.notify.error(apiErrorInfo(err).message || 'The sale was refused.');
        },
      });
  }

  /** The reset that defines perceived speed: one motion back to a ready cart. */
  newSale(): void {
    this.lastReceipt.set(null);
    this.screen.set('sell');
  }

  // -------------------------------------------------------------------------
  // Session acts: X report, drawer movements, the close
  // -------------------------------------------------------------------------

  xReport(onDone: (report: SessionReport) => void): void {
    const session = this.session();
    if (!session) return;
    this.proxy.x_report(session.id).subscribe({
      next: onDone,
      error: (err) => this.notify.error(apiErrorInfo(err).message || 'Could not read the X.'),
    });
  }

  cashMovement(kind: 'paid_in' | 'paid_out', amount: string, reason: string, done: () => void): void {
    const session = this.session();
    if (!session || this.busy()) return;
    if (num(amount) <= 0 || !reason.trim()) {
      this.notify.error('Amount and reason are both required.');
      return;
    }
    this.busy.set(true);
    this.proxy
      .add_cash_movement(session.id, { kind, amount: String(num(amount)), reason: reason.trim() })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.notify.success(kind === 'paid_in' ? 'Paid in' : 'Paid out');
          done();
        },
        error: (err) => {
          this.busy.set(false);
          this.notify.error(apiErrorInfo(err).message || 'Could not record the movement.');
        },
      });
  }

  closeSession(
    counts: Array<{ tender: string; counted: number; sheet?: DenominationCount[] }>,
    note: string,
    onClosed: (session: SessionView) => void,
  ): void {
    const session = this.session();
    if (!session || this.busy()) return;
    const body = {
      counts: counts.map(
        (c): SessionCountRequest => ({
          tender: c.tender,
          counted: c.counted.toFixed(2),
          denominations: c.sheet?.length ? c.sheet : undefined,
        }),
      ),
      note: note.trim() || undefined,
      unsynced: 0,
    };
    this.busy.set(true);
    this.proxy.close_session(session.id, body).subscribe({
      next: (closed) => {
        this.busy.set(false);
        this.session.set(closed);
        onClosed(closed);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'The close was refused.');
      },
    });
  }
}
