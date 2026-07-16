import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { asDateString, fmtMoney, fmtQty, num } from '../../shared/scm-format';
import { warehouseLookup } from '../../shared/scm-lookups';
import {
  CreateCreditNoteRequest,
  CreditNoteLineRequest,
  CreditNoteView,
  InventoryServiceProxy,
  SalesInvoiceHeader,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

interface CreditLine {
  invoice_line_id: string;
  sku: string;
  description: string;
  invoiced: string;
  unit_price: string;
  qty: string;
  discount_pct: string;
  restock: boolean;
  batch_no: string;
}

/** Raise a credit note against a posted invoice, optionally restocking returned goods. */
@Component({
  selector: 'app-credit-note-new-page',
  imports: [FormsModule, RouterLink, UiButton, UiDatepicker, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './credit-note-new.page.html',
})
export class CreditNoteNewPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly inventory = inject(InventoryServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly canPost = computed(() => this.auth.hasPermission(Permissions.creditNotesPost));

  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly invoices = signal<SalesInvoiceHeader[]>([]);
  readonly invoiceCurrency = signal('');

  readonly warehouseLookup = warehouseLookup(this.inventory);

  form = {
    invoice_id: '',
    credit_date: DateTime.now() as DateTime | undefined,
    reason: '',
    memo: '',
    restock_warehouse_id: '',
    restock_warehouse_label: '',
  };

  readonly lines = signal<CreditLine[]>([]);

  readonly anyRestock = computed(() => this.lines().some((l) => l.restock));

  readonly total = computed(() => {
    let subtotal = 0;
    for (const l of this.lines()) {
      subtotal += num(l.qty) * num(l.unit_price) * (1 - num(l.discount_pct) / 100);
    }
    return subtotal;
  });

  constructor() {
    this.proxy.list_invoices2(null, null, 'posted', null, null).subscribe({
      next: (all) => this.invoices.set(all ?? []),
      error: () => {},
    });
    const qpInvoice = this.route.snapshot.queryParamMap.get('invoice');
    if (qpInvoice) {
      this.form.invoice_id = qpInvoice;
      this.loadInvoice(qpInvoice);
    }
  }

  onInvoiceChange(): void {
    if (this.form.invoice_id) this.loadInvoice(this.form.invoice_id);
    else {
      this.lines.set([]);
      this.invoiceCurrency.set('');
    }
  }

  private loadInvoice(id: string): void {
    this.proxy.get_invoice2(id).subscribe({
      next: (inv) => {
        this.invoiceCurrency.set(inv.currency);
        this.lines.set(
          inv.lines.map((l) => ({
            invoice_line_id: l.id,
            sku: l.sku,
            description: l.description,
            invoiced: l.qty,
            unit_price: String(num(l.unit_price)),
            qty: String(num(l.qty)),
            discount_pct: l.discount_pct ?? '',
            restock: false,
            batch_no: '',
          })),
        );
      },
      error: (err) => this.notify.error('Could not load the invoice', apiErrorInfo(err).message),
    });
  }

  recompute(): void {
    this.lines.update((ls) => [...ls]);
  }

  saveDraft(): void {
    this.submit(false);
  }

  savePost(): void {
    this.submit(true);
  }

  private submit(post: boolean): void {
    if (this.saving()) return;
    const body = this.build();
    if (!body) return;

    this.saving.set(true);
    const save$ = this.proxy.create_note(body);
    const flow$ = post
      ? save$.pipe(switchMap((c: CreditNoteView) => this.proxy.post_note(c.id)))
      : save$;
    flow$.subscribe({
      next: (c) => {
        this.saving.set(false);
        this.notify.success(post ? 'Credit note posted' : 'Credit note saved');
        void this.router.navigate(['/sales/credit-notes', c.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the credit note.');
      },
    });
  }

  private build(): CreateCreditNoteRequest | null {
    this.formError.set(null);
    if (!this.form.invoice_id) {
      this.formError.set('Select an invoice to credit.');
      return null;
    }
    const date = this.form.credit_date;
    if (!date || !date.isValid) {
      this.formError.set('A valid credit date is required.');
      return null;
    }
    if (!this.form.reason.trim()) {
      this.formError.set('A reason is required.');
      return null;
    }
    if (this.anyRestock() && !this.form.restock_warehouse_id) {
      this.formError.set('Pick a warehouse to restock into.');
      return null;
    }
    const lines: CreditNoteLineRequest[] = [];
    for (const l of this.lines()) {
      const qty = num(l.qty);
      if (qty <= 0) continue;
      lines.push({
        invoice_line_id: l.invoice_line_id,
        qty: qty.toString(),
        unit_price: l.unit_price.trim() ? Number(l.unit_price).toString() : undefined,
        discount_pct: l.discount_pct.trim() ? Number(l.discount_pct).toString() : undefined,
        restock: l.restock,
        restock_warehouse_id: l.restock ? this.form.restock_warehouse_id : undefined,
        batch_no: l.batch_no.trim() || undefined,
      });
    }
    if (lines.length === 0) {
      this.formError.set('Enter a quantity on at least one line.');
      return null;
    }
    return {
      invoice_id: this.form.invoice_id,
      credit_date: asDateString(date),
      reason: this.form.reason.trim(),
      memo: this.form.memo.trim() || undefined,
      lines,
    };
  }

  readonly fmtQty = fmtQty;
  readonly fmtMoney = fmtMoney;
  readonly num = num;
}
