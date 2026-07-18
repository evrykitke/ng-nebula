import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { PageSkeleton } from '../../../../shared/ui/skeleton';
import { Lookup } from '../../../../shared/lookup/lookup';
import { Modal } from '../../../../shared/ui/modal';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { optDec } from '../../../../shared/forms/numeric';
import { fmtPct } from '../../shared/scm-format';
import { priceListLookup } from '../../shared/scm-lookups';
import {
  GroupBody,
  SalesCustomerGroup,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/** Customer groups — shared pricing and discount defaults for a set of customers. */
@Component({
  selector: 'app-customer-groups-page',
  imports: [PageSkeleton, FormsModule, RouterLink, NgIcon, UiButton, Lookup, Modal, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-groups.page.html',
})
export class CustomerGroupsPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  readonly canManage = computed(() => this.auth.hasPermission(Permissions.customersCreate));

  readonly groups = signal<SalesCustomerGroup[]>([]);
  readonly loading = signal(true);
  readonly modal = signal(false);
  readonly saving = signal(false);
  readonly editId = signal<string | null>(null);
  readonly formError = signal<string | null>(null);

  readonly priceListLookup = priceListLookup(this.proxy);
  readonly fmtPct = fmtPct;

  form = {
    name: '',
    description: '',
    default_discount_pct: '',
    price_list_id: '',
    price_list_label: '',
    is_active: true,
  };

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.proxy.list_groups().subscribe({
      next: (g) => {
        this.groups.set(g ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openNew(): void {
    this.editId.set(null);
    this.formError.set(null);
    this.form = {
      name: '',
      description: '',
      default_discount_pct: '',
      price_list_id: '',
      price_list_label: '',
      is_active: true,
    };
    this.modal.set(true);
  }

  openEdit(g: SalesCustomerGroup): void {
    this.editId.set(g.id);
    this.formError.set(null);
    this.form = {
      name: g.name,
      description: g.description ?? '',
      default_discount_pct: g.default_discount_pct ?? '',
      price_list_id: g.price_list_id ?? '',
      price_list_label: '',
      is_active: g.is_active,
    };
    if (g.price_list_id) {
      this.proxy.list_lists().subscribe({
        next: (lists) => {
          const l = (lists ?? []).find((x) => x.id === g.price_list_id);
          if (l) this.form.price_list_label = l.name;
        },
        error: () => {},
      });
    }
    this.modal.set(true);
  }

  save(): void {
    if (this.saving()) return;
    this.formError.set(null);
    if (!this.form.name.trim()) return this.formError.set('Name is required.');
    const body: GroupBody = {
      name: this.form.name.trim(),
      description: this.form.description.trim() || undefined,
      default_discount_pct: optDec(this.form.default_discount_pct),
      price_list_id: this.form.price_list_id || undefined,
      is_active: this.form.is_active,
    };
    this.saving.set(true);
    const editId = this.editId();
    const save$ = editId ? this.proxy.update_group(editId, body) : this.proxy.create_group(body);
    save$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modal.set(false);
        this.notify.success(editId ? 'Group updated' : 'Group created');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the group.');
      },
    });
  }

  async remove(g: SalesCustomerGroup): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete this group?',
      message: `${g.name} will be removed. Customers keep their own settings.`,
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.proxy.delete_group(g.id).subscribe({
      next: () => {
        this.notify.success('Group deleted');
        this.load();
      },
      error: (err) => this.notify.error('Could not delete the group', apiErrorInfo(err).message),
    });
  }
}
