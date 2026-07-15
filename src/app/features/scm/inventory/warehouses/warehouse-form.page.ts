import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiButton } from '../../../../shared/ui/button';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import {
  InventoryServiceProxy,
  InventoryWarehouse,
  WarehouseBody,
} from '../../../../shared/service-proxies/service-proxies';

/** Create or edit a warehouse. */
@Component({
  selector: 'app-warehouse-form-page',
  imports: [FormsModule, RouterLink, UiButton, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './warehouse-form.page.html',
})
export class WarehouseFormPage {
  private readonly proxy = inject(InventoryServiceProxy);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly editId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly title = computed(() => (this.editId() ? 'Edit warehouse' : 'New warehouse'));

  form = {
    code: '',
    name: '',
    is_active: true,
    is_default: false,
    allow_negative: false,
    contact_name: '',
    phone: '',
    email: '',
    address_line1: '',
    address_line2: '',
    city: '',
    region: '',
    postal_code: '',
    country: '',
    notes: '',
  };

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.editId.set(id);
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.proxy.get_warehouse(id).subscribe({
      next: (w: InventoryWarehouse) => {
        this.form = {
          code: w.code,
          name: w.name,
          is_active: w.is_active,
          is_default: w.is_default,
          allow_negative: w.allow_negative,
          contact_name: w.contact_name ?? '',
          phone: w.phone ?? '',
          email: w.email ?? '',
          address_line1: w.address_line1 ?? '',
          address_line2: w.address_line2 ?? '',
          city: w.city ?? '',
          region: w.region ?? '',
          postal_code: w.postal_code ?? '',
          country: w.country ?? '',
          notes: w.notes ?? '',
        };
      },
      error: (err) => {
        this.notify.error('Could not load the warehouse', apiErrorInfo(err).message);
        void this.router.navigate(['/inventory/warehouses']);
      },
    });
  }

  save(): void {
    if (this.saving()) return;
    this.formError.set(null);
    if (!this.form.code.trim()) return this.formError.set('Code is required.');
    if (!this.form.name.trim()) return this.formError.set('Name is required.');

    const opt = (v: string): string | undefined => v.trim() || undefined;
    const body: WarehouseBody = {
      code: this.form.code.trim(),
      name: this.form.name.trim(),
      is_active: this.form.is_active,
      is_default: this.form.is_default,
      allow_negative: this.form.allow_negative,
      contact_name: opt(this.form.contact_name),
      phone: opt(this.form.phone),
      email: opt(this.form.email),
      address_line1: opt(this.form.address_line1),
      address_line2: opt(this.form.address_line2),
      city: opt(this.form.city),
      region: opt(this.form.region),
      postal_code: opt(this.form.postal_code),
      country: opt(this.form.country),
      notes: opt(this.form.notes),
    };

    this.saving.set(true);
    const editId = this.editId();
    const save$ = editId
      ? this.proxy.update_warehouse(editId, body)
      : this.proxy.create_warehouse(body);
    save$.subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success(editId ? 'Warehouse updated' : 'Warehouse created');
        void this.router.navigate(['/inventory/warehouses']);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the warehouse.');
      },
    });
  }
}
