import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiButton } from '../../../../shared/ui/button';
import { Lookup } from '../../../../shared/lookup/lookup';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { optDec as dec, optInt as int } from '../../../../shared/forms/numeric';
import { taxCodeLookup } from '../../shared/scm-lookups';
import {
  AccountingServiceProxy,
  ProcurementServiceProxy,
  ProcurementSupplier,
  SupplierBody,
} from '../../../../shared/service-proxies/service-proxies';

/**
 * The supplier master form (create + edit). Grouped into identity, contact,
 * commercial terms, address and banking — a supplier carries a lot of fields
 * but most are optional, so the layout keeps the required few up top.
 */
@Component({
  selector: 'app-supplier-form-page',
  imports: [FormsModule, RouterLink, UiButton, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './supplier-form.page.html',
})
export class SupplierFormPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly accounting = inject(AccountingServiceProxy);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly editId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly title = computed(() => (this.editId() ? 'Edit supplier' : 'New supplier'));

  readonly taxLookup = taxCodeLookup(this.accounting, 'input');

  readonly supplierTypes = ['company', 'individual'];

  form = {
    code: '',
    name: '',
    legal_name: '',
    supplier_type: 'company',
    is_active: true,
    is_preferred: false,
    on_hold: false,
    hold_reason: '',
    // contact
    contact_name: '',
    email: '',
    phone: '',
    secondary_contact_name: '',
    secondary_email: '',
    secondary_phone: '',
    website: '',
    // commercial
    currency: 'USD',
    payment_terms_days: '30',
    default_discount_pct: '',
    default_tax_code_id: '',
    default_tax_label: '',
    credit_limit: '',
    min_order_value: '',
    lead_time_days: '',
    incoterms: '',
    tax_number: '',
    registration_no: '',
    industry: '',
    // address
    address_line1: '',
    address_line2: '',
    city: '',
    region: '',
    postal_code: '',
    country: '',
    // banking
    bank_name: '',
    bank_branch: '',
    bank_account_name: '',
    bank_account_no: '',
    bank_swift: '',
    mobile_money_no: '',
    payment_notes: '',
    notes: '',
  };

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.editId.set(id);
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.proxy.get_supplier(id).subscribe({
      next: (s) => this.prefill(s),
      error: (err) => {
        this.notify.error('Could not load the supplier', apiErrorInfo(err).message);
        void this.router.navigate(['/procurement/suppliers']);
      },
    });
  }

  private prefill(s: ProcurementSupplier): void {
    this.form = {
      ...this.form,
      code: s.code,
      name: s.name,
      legal_name: s.legal_name ?? '',
      supplier_type: s.supplier_type,
      is_active: s.is_active,
      is_preferred: s.is_preferred,
      on_hold: s.on_hold,
      hold_reason: s.hold_reason ?? '',
      contact_name: s.contact_name ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      secondary_contact_name: s.secondary_contact_name ?? '',
      secondary_email: s.secondary_email ?? '',
      secondary_phone: s.secondary_phone ?? '',
      website: s.website ?? '',
      currency: s.currency,
      payment_terms_days: String(s.payment_terms_days),
      default_discount_pct: s.default_discount_pct ?? '',
      default_tax_code_id: s.default_tax_code_id ?? '',
      credit_limit: s.credit_limit ?? '',
      min_order_value: s.min_order_value ?? '',
      lead_time_days: s.lead_time_days != null ? String(s.lead_time_days) : '',
      incoterms: s.incoterms ?? '',
      tax_number: s.tax_number ?? '',
      registration_no: s.registration_no ?? '',
      industry: s.industry ?? '',
      address_line1: s.address_line1 ?? '',
      address_line2: s.address_line2 ?? '',
      city: s.city ?? '',
      region: s.region ?? '',
      postal_code: s.postal_code ?? '',
      country: s.country ?? '',
      bank_name: s.bank_name ?? '',
      bank_branch: s.bank_branch ?? '',
      bank_account_name: s.bank_account_name ?? '',
      bank_account_no: s.bank_account_no ?? '',
      bank_swift: s.bank_swift ?? '',
      mobile_money_no: s.mobile_money_no ?? '',
      payment_notes: s.payment_notes ?? '',
      notes: s.notes ?? '',
    };
    if (s.default_tax_code_id) {
      this.accounting.list_tax_codes().subscribe({
        next: (codes) => {
          const t = (codes ?? []).find((x) => x.id === s.default_tax_code_id);
          if (t) this.form.default_tax_label = `${t.code} (${Number(t.rate)}%)`;
        },
        error: () => {},
      });
    }
  }

  save(): void {
    if (this.saving()) return;
    this.formError.set(null);
    if (!this.form.code.trim()) return this.formError.set('Code is required.');
    if (!this.form.name.trim()) return this.formError.set('Name is required.');
    if (!this.form.currency.trim()) return this.formError.set('Currency is required.');

    const opt = (v: string): string | undefined => v.trim() || undefined;

    const body: SupplierBody = {
      code: this.form.code.trim(),
      name: this.form.name.trim(),
      legal_name: opt(this.form.legal_name),
      supplier_type: this.form.supplier_type,
      is_active: this.form.is_active,
      is_preferred: this.form.is_preferred,
      on_hold: this.form.on_hold,
      hold_reason: opt(this.form.hold_reason),
      contact_name: opt(this.form.contact_name),
      email: opt(this.form.email),
      phone: opt(this.form.phone),
      secondary_contact_name: opt(this.form.secondary_contact_name),
      secondary_email: opt(this.form.secondary_email),
      secondary_phone: opt(this.form.secondary_phone),
      website: opt(this.form.website),
      currency: this.form.currency.trim().toUpperCase(),
      payment_terms_days: int(this.form.payment_terms_days) ?? 0,
      default_discount_pct: dec(this.form.default_discount_pct),
      default_tax_code_id: this.form.default_tax_code_id || undefined,
      credit_limit: dec(this.form.credit_limit),
      min_order_value: dec(this.form.min_order_value),
      lead_time_days: int(this.form.lead_time_days),
      incoterms: opt(this.form.incoterms),
      tax_number: opt(this.form.tax_number),
      registration_no: opt(this.form.registration_no),
      industry: opt(this.form.industry),
      address_line1: opt(this.form.address_line1),
      address_line2: opt(this.form.address_line2),
      city: opt(this.form.city),
      region: opt(this.form.region),
      postal_code: opt(this.form.postal_code),
      country: opt(this.form.country),
      bank_name: opt(this.form.bank_name),
      bank_branch: opt(this.form.bank_branch),
      bank_account_name: opt(this.form.bank_account_name),
      bank_account_no: opt(this.form.bank_account_no),
      bank_swift: opt(this.form.bank_swift),
      mobile_money_no: opt(this.form.mobile_money_no),
      payment_notes: opt(this.form.payment_notes),
      notes: opt(this.form.notes),
    };

    this.saving.set(true);
    const editId = this.editId();
    const save$ = editId
      ? this.proxy.update_supplier(editId, body)
      : this.proxy.create_supplier(body);
    save$.subscribe({
      next: (s) => {
        this.saving.set(false);
        this.notify.success(editId ? 'Supplier updated' : 'Supplier created');
        void this.router.navigate(['/procurement/suppliers', s.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the supplier.');
      },
    });
  }
}
