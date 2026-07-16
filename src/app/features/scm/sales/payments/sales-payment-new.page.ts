import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DateTime } from 'luxon';
import { switchMap } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button';
import { UiDatepicker } from '../../../../shared/ui/datepicker';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { asDateString, fmtMoney, num } from '../../shared/scm-format';
import {
  CreateSalesPaymentRequest,
  SalesCustomer,
  SalesInvoiceHeader,
  SalesPaymentView,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** An open invoice the receipt can settle. */
interface ReceivableRow {
  invoice_id: string;
  number: string;
  currency: string;
  outstanding: number;
  selected: boolean;
  amount: string;
}

/** Record a customer payment and allocate it across their open invoices. */
@Component({
  selector: 'app-sales-payment-new-page',
  imports: [FormsModule, RouterLink, UiButton, UiDatepicker, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-payment-new.page.html',
})
export class SalesPaymentNewPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly canPost = computed(() => this.auth.hasPermission(Permissions.salesPaymentsPost));

  readonly methods = ['bank_transfer', 'cash', 'mobile_money', 'cheque', 'card'];

  readonly customers = signal<SalesCustomer[]>([]);
  readonly rows = signal<ReceivableRow[]>([]);
  readonly loadingInvoices = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly fmtMoney = fmtMoney;

  form = {
    customer_id: '',
    payment_date: DateTime.now() as DateTime | undefined,
    method: 'bank_transfer',
    reference: '',
    memo: '',
  };

  readonly currency = computed(() => this.rows()[0]?.currency ?? '');

  readonly total = computed(() =>
    this.rows().reduce((sum, r) => (r.selected ? sum + num(r.amount) : sum), 0),
  );

  constructor() {
    this.proxy.list_customers().subscribe({
      next: (all) => {
        this.customers.set((all ?? []).filter((c) => c.is_active));
        const qp = this.route.snapshot.queryParamMap.get('customer');
        if (qp) {
          this.form.customer_id = qp;
          this.onCustomerChange();
        }
      },
      error: () => {},
    });
  }

  onCustomerChange(): void {
    this.rows.set([]);
    this.formError.set(null);
    if (!this.form.customer_id) return;
    this.loadingInvoices.set(true);
    this.proxy.list_invoices2(this.form.customer_id, null, 'posted', null, null).subscribe({
      next: (all) => {
        const open = (all ?? []).filter((i: SalesInvoiceHeader) => num(i.outstanding) > 0);
        const ccy = open[0]?.currency ?? '';
        this.rows.set(
          open
            .filter((i) => i.currency === ccy)
            .map((i) => ({
              invoice_id: i.id,
              number: i.number ?? '(draft)',
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

  toggle(row: ReceivableRow): void {
    row.selected = !row.selected;
    this.rows.set([...this.rows()]);
  }

  onAmountChange(): void {
    this.rows.set([...this.rows()]);
  }

  payFull(row: ReceivableRow): void {
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
    const create$ = this.proxy.create_payment2(body);
    const flow$ = post
      ? create$.pipe(switchMap((p: SalesPaymentView) => this.proxy.post_payment2(p.id)))
      : create$;
    flow$.subscribe({
      next: (p) => {
        this.saving.set(false);
        this.notify.success(post ? 'Payment posted' : 'Draft saved');
        void this.router.navigate(['/sales/payments', p.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the payment.');
      },
    });
  }

  private build(): CreateSalesPaymentRequest | null {
    this.formError.set(null);
    if (!this.form.customer_id) {
      this.formError.set('Pick a customer.');
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
      this.formError.set('Select at least one invoice to settle.');
      return null;
    }
    const total = allocations.reduce((s, a) => s + num(a.amount), 0);
    return {
      customer_id: this.form.customer_id,
      payment_date: asDateString(this.form.payment_date),
      method: this.form.method,
      reference: this.form.reference.trim() || undefined,
      currency: this.currency() || undefined,
      amount: total.toFixed(2),
      memo: this.form.memo.trim() || undefined,
      allocations,
    };
  }
}
