import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DateTime } from 'luxon';
import { UiButton } from '../../../../shared/ui/button';
import { UiDatepicker } from '../../../../shared/ui/datepicker';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { asDateString } from '../../shared/scm-format';
import {
  ListScope,
  PriceListBody,
  SalesPriceList,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** Create or edit a price-list header. Its item prices are managed on the detail page. */
@Component({
  selector: 'app-price-list-form-page',
  imports: [FormsModule, RouterLink, UiButton, UiDatepicker, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-list-form.page.html',
})
export class PriceListFormPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly editId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly title = computed(() => (this.editId() ? 'Edit price list' : 'New price list'));

  readonly scopes: ListScope[] = ['default', 'group', 'customer'];

  form = {
    name: '',
    currency: 'USD',
    scope: 'default' as ListScope,
    description: '',
    is_promotional: false,
    tax_inclusive: false,
    valid_from: undefined as DateTime | undefined,
    valid_to: undefined as DateTime | undefined,
  };

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.editId.set(id);
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.proxy.get_list(id).subscribe({
      next: (l: SalesPriceList) => {
        this.form = {
          name: l.name,
          currency: l.currency,
          scope: l.scope as ListScope,
          description: l.description ?? '',
          is_promotional: l.is_promotional,
          tax_inclusive: l.tax_inclusive,
          valid_from: l.valid_from,
          valid_to: l.valid_to,
        };
      },
      error: (err) => {
        this.notify.error('Could not load the price list', apiErrorInfo(err).message);
        void this.router.navigate(['/sales/price-lists']);
      },
    });
  }

  save(): void {
    if (this.saving()) return;
    this.formError.set(null);
    if (!this.form.name.trim()) return this.formError.set('Name is required.');
    if (!this.form.currency.trim()) return this.formError.set('Currency is required.');

    const body: PriceListBody = {
      name: this.form.name.trim(),
      currency: this.form.currency.trim().toUpperCase(),
      scope: this.form.scope,
      description: this.form.description.trim() || undefined,
      is_promotional: this.form.is_promotional,
      tax_inclusive: this.form.tax_inclusive,
      valid_from: this.form.valid_from ? asDateString(this.form.valid_from) : undefined,
      valid_to: this.form.valid_to ? asDateString(this.form.valid_to) : undefined,
    };

    this.saving.set(true);
    const editId = this.editId();
    const save$ = editId ? this.proxy.update_list(editId, body) : this.proxy.create_list(body);
    save$.subscribe({
      next: (l) => {
        this.saving.set(false);
        this.notify.success(editId ? 'Price list updated' : 'Price list created');
        void this.router.navigate(['/sales/price-lists', l.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the price list.');
      },
    });
  }
}
