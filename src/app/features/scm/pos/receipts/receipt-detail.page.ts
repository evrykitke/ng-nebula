import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { catchError, forkJoin, map, of } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button';
import { PageSkeleton } from '../../../../shared/ui/skeleton';
import { Modal } from '../../../../shared/ui/modal';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { fmtDateTime, fmtMoney, fmtQty, num } from '../../shared/scm-format';
import { TENDERS, tenderLabel } from '../shared/pos-format';
import { printReceipt } from '../shared/receipt-print';
import {
  AuthServiceProxy,
  CompanyProfileResponse,
  PosOrderView,
  PosRegister,
  PosServiceProxy,
  SessionView,
  Settings,
} from '../../../../shared/service-proxies/service-proxies';

/**
 * One receipt: the lines, the money, and the two things one does to a captured
 * sale afterwards — void it, or refund some of it. Both are supervised acts:
 * the server accepts them from a caller holding the Override / Refund
 * permission (the PIN-approval path belongs to the till, where the supervisor
 * is standing next to the cashier).
 */
@Component({
  selector: 'app-pos-receipt-detail-page',
  imports: [PageSkeleton, FormsModule, RouterLink, NgIcon, UiButton, Modal, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './receipt-detail.page.html',
})
export class ReceiptDetailPage {
  private readonly proxy = inject(PosServiceProxy);
  private readonly authProxy = inject(AuthServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly order = signal<PosOrderView | null>(null);

  readonly canOverride = computed(() => this.auth.hasPermission(Permissions.posOverride));
  readonly canRefund = computed(() => this.auth.hasPermission(Permissions.posRefund));

  readonly isSale = computed(() => this.order()?.kind === 'sale');
  readonly isCaptured = computed(() => this.order()?.status === 'captured');

  readonly fmtDateTime = fmtDateTime;
  readonly fmtMoney = fmtMoney;
  readonly fmtQty = fmtQty;
  readonly num = num;
  readonly tenderLabel = tenderLabel;
  readonly tenders = TENDERS;

  // --- void ---
  readonly voidModal = signal(false);
  voidReason = '';

  // --- refund ---
  readonly refundModal = signal(false);
  readonly openSessions = signal<SessionView[]>([]);
  refundSession = '';
  refundTender = 'cash';
  refundReference = '';
  refundQty: Record<string, string> = {};

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
    this.proxy.get_sale(this.id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the receipt.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Reprint to the tenant's configured paper. The register's header/footer
   * are resolved through the session — best-effort, since either lookup may
   * be denied; the receipt prints without them then.
   */
  print(): void {
    const o = this.order();
    if (!o) return;
    forkJoin({
      settings: this.proxy.get_settings().pipe(catchError(() => of(null as Settings | null))),
      company: this.authProxy
        .tenant_profile_get()
        .pipe(catchError(() => of(null as CompanyProfileResponse | null))),
      register: this.proxy.get_session(o.session_id).pipe(
        map((s) => s.register_id),
        catchError(() => of(null)),
      ),
    }).subscribe(({ settings, company, register }) => {
      const done = (reg: PosRegister | null) =>
        printReceipt(o, settings, company, reg?.receipt_header, reg?.receipt_footer);
      if (!register) {
        done(null);
        return;
      }
      this.proxy
        .get_register(register)
        .pipe(catchError(() => of(null as PosRegister | null)))
        .subscribe(done);
    });
  }

  openVoid(): void {
    this.voidReason = '';
    this.voidModal.set(true);
  }

  confirmVoid(): void {
    if (this.busy()) return;
    if (!this.voidReason.trim()) {
      this.notify.error('A reason is required — the void is audited.');
      return;
    }
    this.busy.set(true);
    this.proxy.void_sale(this.id, { reason: this.voidReason.trim() }).subscribe({
      next: (o) => {
        this.busy.set(false);
        this.voidModal.set(false);
        this.order.set(o);
        this.notify.success('Receipt voided');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not void the receipt.');
      },
    });
  }

  /**
   * A refund is paid out of an open session's drawer, so the modal offers the
   * sessions currently open — found through the registers (the Sell-visible
   * path), not the reports-gated session list.
   */
  openRefund(): void {
    const o = this.order();
    if (!o) return;
    this.refundQty = {};
    this.refundTender = o.payments[0]?.tender ?? 'cash';
    this.refundReference = '';
    this.refundSession = '';
    this.refundModal.set(true);
    this.proxy
      .list_registers()
      .pipe(
        map((regs) => (regs ?? []).filter((r) => r.is_active)),
        catchError(() => of([])),
      )
      .subscribe((regs) => {
        if (!regs.length) return;
        forkJoin(
          regs.map((r) => this.proxy.current_session(r.id).pipe(catchError(() => of(null)))),
        ).subscribe((sessions) => {
          const open = sessions.filter((s): s is SessionView => !!s);
          this.openSessions.set(open);
          // The sale's own session, when it is still open, is the natural drawer.
          const own = open.find((s) => s.id === o.session_id);
          this.refundSession = own?.id ?? open[0]?.id ?? '';
        });
      });
  }

  refundTotal(): number {
    const o = this.order();
    if (!o) return 0;
    let cents = 0;
    for (const l of o.lines) {
      const qty = num(this.refundQty[l.id]);
      if (qty > 0) cents += Math.round(num(l.unit_price) * 100) * qty;
    }
    return cents / 100;
  }

  confirmRefund(): void {
    if (this.busy()) return;
    const o = this.order();
    if (!o) return;
    const lines = o.lines
      .map((l) => ({ line_id: l.id, qty: String(num(this.refundQty[l.id])) }))
      .filter((l) => num(l.qty) > 0);
    if (!lines.length) {
      this.notify.error('Enter a quantity on at least one line.');
      return;
    }
    if (!this.refundSession) {
      this.notify.error('A refund is paid out of an open session — open the till first.');
      return;
    }
    this.busy.set(true);
    this.proxy
      .refund_sale(this.id, {
        client_uuid: crypto.randomUUID(),
        session_id: this.refundSession,
        tender: this.refundTender,
        reference: this.refundReference.trim() || undefined,
        lines,
      })
      .subscribe({
        next: (refund) => {
          this.busy.set(false);
          this.refundModal.set(false);
          this.notify.success(`Refund ${refund.number ?? ''} captured`);
          void this.router.navigate(['/pos/receipts', refund.id]);
        },
        error: (err) => {
          this.busy.set(false);
          this.notify.error(apiErrorInfo(err).message || 'Could not capture the refund.');
        },
      });
  }
}
