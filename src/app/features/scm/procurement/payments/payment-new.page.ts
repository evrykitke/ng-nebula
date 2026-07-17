import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DateTime } from 'luxon';
import { switchMap } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button';
import { PageSkeleton } from '../../../../shared/ui/skeleton';
import { UiDatepicker } from '../../../../shared/ui/datepicker';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { asDateString, fmtMoney, num } from '../../shared/scm-format';
import {
  CreatePaymentRequest,
  InvoiceHeader,
  PaymentView,
  ProcurementServiceProxy,
  ProcurementSupplier,
} from '../../../../shared/service-proxies/service-proxies';

/** A payable invoice the user can settle on this payment. */
interface PayableRow {
  invoice_id: string;
  number: string;
  supplier_invoice_no: string;
  currency: string;
  outstanding: number;
  selected: boolean;
  amount: string;
}

/** Record a supplier payment and allocate it across their open invoices. */
@Component({
  selector: 'app-payment-new-page',
  imports: [PageSkeleton, FormsModule, RouterLink, UiButton, UiDatepicker, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-new.page.html',
})
export class PaymentNewPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  readonly canPost = computed(() => this.auth.hasPermission(Permissions.paymentsPost));

  readonly methods = ['bank_transfer', 'cash', 'mobile_money', 'cheque', 'card'];

  readonly suppliers = signal<ProcurementSupplier[]>([]);
  readonly rows = signal<PayableRow[]>([]);
  readonly loadingInvoices = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly fmtMoney = fmtMoney;

  form = {
    supplier_id: '',
    payment_date: DateTime.now() as DateTime | undefined,
    method: 'bank_transfer',
    reference: '',
    memo: '',
  };

  /** The currency of the loaded payables (all share one; blank until known). */
  readonly currency = computed(() => this.rows()[0]?.currency ?? '');

  readonly total = computed(() =>
    this.rows().reduce((sum, r) => (r.selected ? sum + num(r.amount) : sum), 0),
  );

  constructor() {
    this.proxy.list_suppliers().subscribe({
      next: (all) => this.suppliers.set((all ?? []).filter((s) => s.is_active)),
      error: () => {},
    });
  }

  onSupplierChange(): void {
    this.rows.set([]);
    this.formError.set(null);
    if (!this.form.supplier_id) return;
    this.loadingInvoices.set(true);
    this.proxy.list_invoices(this.form.supplier_id, null, 'posted', null, null).subscribe({
      next: (all) => {
        const payable = (all ?? []).filter((i: InvoiceHeader) => num(i.outstanding) > 0);
        // All allocations on one payment share a currency; anchor on the first.
        const ccy = payable[0]?.currency ?? '';
        this.rows.set(
          payable
            .filter((i) => i.currency === ccy)
            .map((i) => ({
              invoice_id: i.id,
              number: i.number ?? '(draft)',
              supplier_invoice_no: i.supplier_invoice_no,
              currency: i.currency,
              outstanding: num(i.outstanding),
              selected: true,
              amount: num(i.outstanding).toFixed(2),
            })),
        );
        this.loadingInvoices.set(false);
      },
      error: (err) => {
        this.loadingInvoices.set(false);
        this.notify.error('Could not load open invoices', apiErrorInfo(err).message);
      },
    });
  }

  toggle(row: PayableRow): void {
    row.selected = !row.selected;
    this.rows.set([...this.rows()]);
  }

  onAmountChange(): void {
    this.rows.set([...this.rows()]);
  }

  payFull(row: PayableRow): void {
    row.amount = row.outstanding.toFixed(2);
    row.selected = true;
    this.rows.set([...this.rows()]);
  }

  saveDraft(): void {
    this.submit(false);
  }

  saveAndPost(): void {
    this.submit(true);
  }

  private submit(post: boolean): void {
    if (this.saving()) return;
    const body = this.build();
    if (!body) return;
    this.saving.set(true);
    const create$ = this.proxy.create_payment(body);
    const flow$ = post
      ? create$.pipe(switchMap((p: PaymentView) => this.proxy.post_payment(p.id)))
      : create$;
    flow$.subscribe({
      next: (p) => {
        this.saving.set(false);
        this.notify.success(post ? 'Payment posted' : 'Draft saved');
        void this.router.navigate(['/procurement/payments', p.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the payment.');
      },
    });
  }

  private build(): CreatePaymentRequest | null {
    this.formError.set(null);
    if (!this.form.supplier_id) {
      this.formError.set('Pick a supplier.');
      return null;
    }
    if (!this.form.payment_date) {
      this.formError.set('A payment date is required.');
      return null;
    }
    const allocations = [];
    for (const r of this.rows()) {
      if (!r.selected) continue;
      const amt = num(r.amount);
      if (!(amt > 0)) {
        this.formError.set(`Enter a positive amount for ${r.number}.`);
        return null;
      }
      if (amt > r.outstanding + 0.001) {
        this.formError.set(`${r.number}: amount exceeds the ${fmtMoney(r.outstanding)} outstanding.`);
        return null;
      }
      allocations.push({ invoice_id: r.invoice_id, amount: amt.toFixed(2) });
    }
    if (allocations.length === 0) {
      this.formError.set('Select at least one invoice to pay.');
      return null;
    }
    const total = allocations.reduce((s, a) => s + num(a.amount), 0);
    return {
      supplier_id: this.form.supplier_id,
      payment_date: asDateString(this.form.payment_date),
      method: this.form.method,
      reference: this.form.reference.trim() || undefined,
      currency: this.currency(),
      amount: total.toFixed(2),
      memo: this.form.memo.trim() || undefined,
      allocations,
    };
  }
}
