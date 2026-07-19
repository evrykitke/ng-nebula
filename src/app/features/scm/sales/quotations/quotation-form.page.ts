import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { DateTime } from 'luxon';
import { switchMap } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button';
import { UiDatepicker } from '../../../../shared/ui/datepicker';
import { Lookup } from '../../../../shared/lookup/lookup';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { asDate } from '../../../../shared/forms/dates';
import { optDec } from '../../../../shared/forms/numeric';
import { asDateString, fmtMoney, num } from '../../shared/scm-format';
import { customerLookup, itemLookup, taxCodeLookup } from '../../shared/scm-lookups';
import {
  AccountingServiceProxy,
  CreateQuotationRequest,
  InventoryItem,
  InventoryServiceProxy,
  QuotationLineRequest,
  QuotationView,
  SalesCustomer,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

interface QuoteLine {
  item_id: string;
  item_label: string;
  description: string;
  qty: string;
  unit_price: string;
  discount_pct: string;
  tax_code_id: string;
  tax_label: string;
}

/**
 * Compose or edit a draft quotation and optionally send it. Leaving a line's
 * unit price blank lets the server resolve it from the customer's price list.
 */
@Component({
  selector: 'app-quotation-form-page',
  imports: [FormsModule, RouterLink, NgIcon, UiButton, UiDatepicker, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quotation-form.page.html',
})
export class QuotationFormPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly inventory = inject(InventoryServiceProxy);
  private readonly accounting = inject(AccountingServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly canSend = computed(() => this.auth.hasPermission(Permissions.quotationsSend));

  readonly editId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly customerLookup = customerLookup(this.proxy, (c) => c.is_active && !c.on_hold);
  readonly itemLookup = itemLookup(this.inventory, (i) => i.is_sellable);
  readonly taxLookup = taxCodeLookup(this.accounting, 'output');

  form = {
    customer_id: '',
    customer_label: '',
    customer_contact: '',
    currency: '',
    quote_date: DateTime.now() as DateTime | undefined,
    valid_until: undefined as DateTime | undefined,
    reference: '',
    discount_pct: '',
    other_charges: '',
    tax_inclusive: false,
    terms_and_conditions: '',
    memo: '',
  };

  readonly lines = signal<QuoteLine[]>([this.blank()]);

  readonly title = computed(() => (this.editId() ? 'Edit quotation' : 'New quotation'));

  readonly totals = computed(() => {
    let subtotal = 0;
    for (const l of this.lines()) {
      subtotal += num(l.qty) * num(l.unit_price) * (1 - num(l.discount_pct) / 100);
    }
    const afterDisc = subtotal * (1 - num(this.form.discount_pct) / 100);
    return { subtotal, total: afterDisc + num(this.form.other_charges) };
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.editId.set(id);
    if (id) this.loadDraft(id);
  }

  private loadDraft(id: string): void {
    this.proxy.get_quotation(id).subscribe({
      next: (q: QuotationView) => {
        if (q.status !== 'draft') {
          this.notify.error('Only a draft can be edited');
          void this.router.navigate(['/sales/quotations', id]);
          return;
        }
        this.form = {
          customer_id: q.customer_id,
          customer_label: q.customer_name,
          customer_contact: q.customer_contact ?? '',
          currency: q.currency,
          quote_date: asDate(q.quote_date),
          valid_until: q.valid_until,
          reference: q.reference ?? '',
          discount_pct: q.discount_pct ?? '',
          other_charges: q.other_charges ?? '',
          tax_inclusive: q.tax_inclusive,
          terms_and_conditions: q.terms_and_conditions ?? '',
          memo: q.memo ?? '',
        };
        this.lines.set(
          q.lines.map((l) => ({
            item_id: l.item_id,
            item_label: `${l.sku} — ${l.item_name}`,
            description: l.description ?? '',
            qty: String(num(l.qty)),
            unit_price: String(num(l.unit_price)),
            discount_pct: l.discount_pct ?? '',
            tax_code_id: '',
            tax_label: '',
          })),
        );
      },
      error: (err) => {
        this.notify.error('Could not load the draft', apiErrorInfo(err).message);
        void this.router.navigate(['/sales/quotations']);
      },
    });
  }

  private blank(): QuoteLine {
    return {
      item_id: '',
      item_label: '',
      description: '',
      qty: '',
      unit_price: '',
      discount_pct: '',
      tax_code_id: '',
      tax_label: '',
    };
  }

  addLine(): void {
    this.lines.update((ls) => [...ls, this.blank()]);
  }

  removeLine(i: number): void {
    this.lines.update((ls) => ls.filter((_, idx) => idx !== i));
  }

  onCustomerSelected(c: SalesCustomer): void {
    this.form.customer_id = c.id;
    this.form.customer_label = `${c.code} — ${c.name}`;
    if (!this.form.currency) this.form.currency = c.currency;
    if (!this.form.customer_contact) this.form.customer_contact = c.contact_name ?? '';
  }

  onItemSelected(line: QuoteLine, item: InventoryItem): void {
    line.item_id = item.id;
    line.item_label = `${item.sku} — ${item.name}`;
    if (!line.description) line.description = item.name;
    if (!line.unit_price && item.selling_price) line.unit_price = String(num(item.selling_price));
    this.lines.update((ls) => [...ls]);
  }

  onItemValue(line: QuoteLine, value: string | null): void {
    line.item_id = value ?? '';
    if (!value) line.item_label = '';
    this.lines.update((ls) => [...ls]);
  }

  recompute(): void {
    this.lines.update((ls) => [...ls]);
  }

  saveDraft(): void {
    this.submit(false);
  }

  saveSend(): void {
    this.submit(true);
  }

  private submit(send: boolean): void {
    if (this.saving()) return;
    const body = this.build();
    if (!body) return;

    this.saving.set(true);
    const editId = this.editId();
    const save$ = editId
      ? this.proxy.update_quotation(editId, body)
      : this.proxy.create_quotation(body);
    const flow$ = send
      ? save$.pipe(switchMap((q: QuotationView) => this.proxy.send_quotation(q.id)))
      : save$;
    flow$.subscribe({
      next: (q) => {
        this.saving.set(false);
        this.notify.success(send ? 'Quotation sent' : 'Draft saved');
        void this.router.navigate(['/sales/quotations', q.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the quotation.');
      },
    });
  }

  private build(): CreateQuotationRequest | null {
    this.formError.set(null);
    if (!this.form.customer_id) {
      this.formError.set('A customer is required.');
      return null;
    }
    const quoteDate = this.form.quote_date;
    if (!quoteDate || !quoteDate.isValid) {
      this.formError.set('A valid quote date is required.');
      return null;
    }
    const lines: QuotationLineRequest[] = [];
    for (const l of this.lines()) {
      if (!l.item_id && !l.qty) continue;
      if (!l.item_id) {
        this.formError.set('Every line needs an item.');
        return null;
      }
      const qty = Number(l.qty);
      if (!(qty > 0)) {
        this.formError.set('Each line needs a positive quantity.');
        return null;
      }
      lines.push({
        item_id: l.item_id,
        description: l.description.trim() || undefined,
        qty: qty.toString(),
        unit_price: optDec(l.unit_price),
        discount_pct: optDec(l.discount_pct),
        tax_code_id: l.tax_code_id || undefined,
      });
    }
    if (lines.length === 0) {
      this.formError.set('Add at least one line.');
      return null;
    }
    return {
      customer_id: this.form.customer_id,
      customer_contact: this.form.customer_contact.trim() || undefined,
      currency: this.form.currency.trim().toUpperCase() || undefined,
      quote_date: asDateString(quoteDate),
      valid_until: this.form.valid_until ? asDateString(this.form.valid_until) : undefined,
      reference: this.form.reference.trim() || undefined,
      discount_pct: optDec(this.form.discount_pct),
      other_charges: optDec(this.form.other_charges),
      tax_inclusive: this.form.tax_inclusive,
      terms_and_conditions: this.form.terms_and_conditions.trim() || undefined,
      memo: this.form.memo.trim() || undefined,
      lines,
    };
  }

  readonly fmtMoney = fmtMoney;
  readonly num = num;
}
