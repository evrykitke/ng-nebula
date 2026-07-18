import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiButton } from '../../../../shared/ui/button';
import { Lookup } from '../../../../shared/lookup/lookup';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { optDec as dec, optInt as int } from '../../../../shared/forms/numeric';
import { priceListLookup, taxCodeLookup, warehouseLookup } from '../../shared/scm-lookups';
import {
  AccountingServiceProxy,
  CustomerBody,
  InventoryServiceProxy,
  SalesCustomer,
  SalesCustomerGroup,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/**
 * The customer master form (create + edit). Grouped into identity, contact,
 * commercial terms, billing and shipping addresses — most fields are optional,
 * so the required few sit up top.
 */
@Component({
  selector: 'app-customer-form-page',
  imports: [FormsModule, RouterLink, UiButton, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-form.page.html',
})
export class CustomerFormPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly inventory = inject(InventoryServiceProxy);
  private readonly accounting = inject(AccountingServiceProxy);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly editId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly groups = signal<SalesCustomerGroup[]>([]);

  readonly title = computed(() => (this.editId() ? 'Edit customer' : 'New customer'));

  readonly taxLookup = taxCodeLookup(this.accounting, 'output');
  readonly warehouseLookup = warehouseLookup(this.inventory);
  readonly priceListLookup = priceListLookup(this.proxy);

  readonly customerTypes = ['company', 'individual'];

  form = {
    code: '',
    name: '',
    legal_name: '',
    customer_type: 'company',
    is_active: true,
    on_hold: false,
    hold_reason: '',
    group_id: '',
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
    credit_limit: '',
    default_discount_pct: '',
    default_tax_code_id: '',
    default_tax_label: '',
    default_warehouse_id: '',
    default_warehouse_label: '',
    price_list_id: '',
    price_list_label: '',
    incoterms: '',
    salesperson_id: '',
    loyalty_no: '',
    tax_exempt: false,
    tax_exemption_no: '',
    tax_number: '',
    registration_no: '',
    industry: '',
    // billing address
    billing_city: '',
    billing_region: '',
    billing_postal_code: '',
    billing_country: '',
    // shipping address
    shipping_city: '',
    shipping_region: '',
    shipping_postal_code: '',
    shipping_country: '',
    notes: '',
  };

  constructor() {
    this.proxy.list_groups().subscribe({
      next: (g) => this.groups.set((g ?? []).filter((x) => x.is_active)),
      error: () => {},
    });
    const id = this.route.snapshot.paramMap.get('id');
    this.editId.set(id);
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.proxy.get_customer(id).subscribe({
      next: (c) => this.prefill(c),
      error: (err) => {
        this.notify.error('Could not load the customer', apiErrorInfo(err).message);
        void this.router.navigate(['/sales/customers']);
      },
    });
  }

  private prefill(c: SalesCustomer): void {
    this.form = {
      ...this.form,
      code: c.code,
      name: c.name,
      legal_name: c.legal_name ?? '',
      customer_type: c.customer_type,
      is_active: c.is_active,
      on_hold: c.on_hold,
      hold_reason: c.hold_reason ?? '',
      group_id: c.group_id ?? '',
      contact_name: c.contact_name ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      secondary_contact_name: c.secondary_contact_name ?? '',
      secondary_email: c.secondary_email ?? '',
      secondary_phone: c.secondary_phone ?? '',
      website: c.website ?? '',
      currency: c.currency,
      payment_terms_days: String(c.payment_terms_days),
      credit_limit: c.credit_limit ?? '',
      default_discount_pct: c.default_discount_pct ?? '',
      default_tax_code_id: c.default_tax_code_id ?? '',
      default_warehouse_id: c.default_warehouse_id ?? '',
      price_list_id: c.price_list_id ?? '',
      incoterms: c.incoterms ?? '',
      salesperson_id: c.salesperson_id ?? '',
      loyalty_no: c.loyalty_no ?? '',
      tax_exempt: c.tax_exempt,
      tax_exemption_no: c.tax_exemption_no ?? '',
      tax_number: c.tax_number ?? '',
      registration_no: c.registration_no ?? '',
      industry: c.industry ?? '',
      billing_city: c.billing_city ?? '',
      billing_region: c.billing_region ?? '',
      billing_postal_code: c.billing_postal_code ?? '',
      billing_country: c.billing_country ?? '',
      shipping_city: c.shipping_city ?? '',
      shipping_region: c.shipping_region ?? '',
      shipping_postal_code: c.shipping_postal_code ?? '',
      shipping_country: c.shipping_country ?? '',
      notes: c.notes ?? '',
    };
    if (c.default_tax_code_id) {
      this.accounting.list_tax_codes().subscribe({
        next: (codes) => {
          const t = (codes ?? []).find((x) => x.id === c.default_tax_code_id);
          if (t) this.form.default_tax_label = `${t.code} (${Number(t.rate)}%)`;
        },
        error: () => {},
      });
    }
    if (c.default_warehouse_id) {
      this.inventory.list_warehouses().subscribe({
        next: (whs) => {
          const w = (whs ?? []).find((x) => x.id === c.default_warehouse_id);
          if (w) this.form.default_warehouse_label = `${w.code} — ${w.name}`;
        },
        error: () => {},
      });
    }
    if (c.price_list_id) {
      this.proxy.list_lists().subscribe({
        next: (lists) => {
          const l = (lists ?? []).find((x) => x.id === c.price_list_id);
          if (l) this.form.price_list_label = l.name;
        },
        error: () => {},
      });
    }
  }

  copyBillingToShipping(): void {
    this.form.shipping_city = this.form.billing_city;
    this.form.shipping_region = this.form.billing_region;
    this.form.shipping_postal_code = this.form.billing_postal_code;
    this.form.shipping_country = this.form.billing_country;
  }

  save(): void {
    if (this.saving()) return;
    this.formError.set(null);
    if (!this.form.code.trim()) return this.formError.set('Code is required.');
    if (!this.form.name.trim()) return this.formError.set('Name is required.');
    if (!this.form.currency.trim()) return this.formError.set('Currency is required.');

    const opt = (v: string): string | undefined => v.trim() || undefined;

    const body: CustomerBody = {
      code: this.form.code.trim(),
      name: this.form.name.trim(),
      legal_name: opt(this.form.legal_name),
      customer_type: this.form.customer_type,
      is_active: this.form.is_active,
      on_hold: this.form.on_hold,
      hold_reason: opt(this.form.hold_reason),
      group_id: this.form.group_id || undefined,
      contact_name: opt(this.form.contact_name),
      email: opt(this.form.email),
      phone: opt(this.form.phone),
      secondary_contact_name: opt(this.form.secondary_contact_name),
      secondary_email: opt(this.form.secondary_email),
      secondary_phone: opt(this.form.secondary_phone),
      website: opt(this.form.website),
      currency: this.form.currency.trim().toUpperCase(),
      payment_terms_days: int(this.form.payment_terms_days) ?? 0,
      credit_limit: dec(this.form.credit_limit),
      default_discount_pct: dec(this.form.default_discount_pct),
      default_tax_code_id: this.form.default_tax_code_id || undefined,
      default_warehouse_id: this.form.default_warehouse_id || undefined,
      price_list_id: this.form.price_list_id || undefined,
      incoterms: opt(this.form.incoterms),
      salesperson_id: this.form.salesperson_id || undefined,
      loyalty_no: opt(this.form.loyalty_no),
      tax_exempt: this.form.tax_exempt,
      tax_exemption_no: opt(this.form.tax_exemption_no),
      tax_number: opt(this.form.tax_number),
      registration_no: opt(this.form.registration_no),
      industry: opt(this.form.industry),
      billing_city: opt(this.form.billing_city),
      billing_region: opt(this.form.billing_region),
      billing_postal_code: opt(this.form.billing_postal_code),
      billing_country: opt(this.form.billing_country),
      shipping_city: opt(this.form.shipping_city),
      shipping_region: opt(this.form.shipping_region),
      shipping_postal_code: opt(this.form.shipping_postal_code),
      shipping_country: opt(this.form.shipping_country),
      notes: opt(this.form.notes),
    };

    this.saving.set(true);
    const editId = this.editId();
    const save$ = editId
      ? this.proxy.update_customer(editId, body)
      : this.proxy.create_customer(body);
    save$.subscribe({
      next: (c) => {
        this.saving.set(false);
        this.notify.success(editId ? 'Customer updated' : 'Customer created');
        void this.router.navigate(['/sales/customers', c.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the customer.');
      },
    });
  }
}
