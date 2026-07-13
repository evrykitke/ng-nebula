import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../shared/ui/button';
import { Modal } from '../../../shared/ui/modal';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { AuthService } from '../../../core/auth/auth.service';
import { Permissions } from '../../../core/auth/permissions.constants';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { DataTable } from '../../../shared/datatable/data-table';
import { TableDataSource } from '../../../shared/datatable/table-config';
import { clientSideSource } from '../../../shared/datatable/client-side';
import { apiErrorInfo } from '../../../shared/api/api-error';
import { taxCodesTable } from './tax-codes.table';
import {
  AccountingAccount,
  AccountingServiceProxy,
  AccountingTaxCode,
  TaxDirection,
} from '../../../shared/service-proxies/service-proxies';

/** Tax codes: rate, direction and the ledger account the tax is booked to. */
@Component({
  selector: 'app-tax-codes-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader, DataTable, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tax-codes.page.html',
})
export class TaxCodesPage {
  private readonly proxy = inject(AccountingServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  private readonly table = viewChild<DataTable<AccountingTaxCode>>(DataTable);

  readonly directions: TaxDirection[] = ['output', 'input'];

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.taxCreate));
  readonly canEdit = computed(() => this.auth.hasPermission(Permissions.taxEdit));
  readonly canDelete = computed(() => this.auth.hasPermission(Permissions.taxDelete));

  readonly accounts = signal<AccountingAccount[]>([]);
  private readonly accountsById = computed(
    () => new Map(this.accounts().map((a) => [a.id, a])),
  );

  readonly tableConfig = computed(() =>
    taxCodesTable({
      canEdit: this.canEdit(),
      canDelete: this.canDelete(),
      accountsById: this.accountsById(),
    }),
  );

  readonly dataSource: TableDataSource<AccountingTaxCode> = clientSideSource(
    () => this.proxy.list_tax_codes(),
    (t, term) => t.code.toLowerCase().includes(term) || t.name.toLowerCase().includes(term),
  );

  constructor() {
    this.proxy.list_accounts().subscribe({
      next: (all) => this.accounts.set(all ?? []),
      error: () => {},
    });
  }

  // Create / edit dialog.
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  editingId: string | null = null;
  editingSystem = false;
  form = this.emptyForm();

  private emptyForm() {
    return {
      code: '',
      name: '',
      rate: '',
      direction: 'output' as TaxDirection,
      account_id: '',
      is_active: true,
    };
  }

  private reload(): void {
    this.table()?.load();
  }

  onAction(event: { key: string; row: AccountingTaxCode }): void {
    if (event.key === 'edit') this.openEdit(event.row);
    else if (event.key === 'delete') void this.remove(event.row);
  }

  openCreate(): void {
    this.editingId = null;
    this.editingSystem = false;
    this.form = this.emptyForm();
    this.formError.set(null);
    this.editing.set(true);
  }

  openEdit(t: AccountingTaxCode): void {
    this.editingId = t.id;
    this.editingSystem = t.is_system;
    this.form = {
      code: t.code,
      name: t.name,
      rate: String(Number(t.rate)),
      direction: t.direction as TaxDirection,
      account_id: t.account_id ?? '',
      is_active: t.is_active,
    };
    this.formError.set(null);
    this.editing.set(true);
  }

  save(): void {
    if (this.saving()) return;
    if (!this.editingId && !this.form.code.trim()) {
      this.formError.set('Code is required.');
      return;
    }
    if (!this.form.name.trim()) {
      this.formError.set('Name is required.');
      return;
    }
    const rate = Number(this.form.rate);
    if (this.form.rate.trim() === '' || Number.isNaN(rate) || rate < 0) {
      this.formError.set('Rate must be a non-negative number.');
      return;
    }
    this.saving.set(true);

    const done = {
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.notify.success(this.editingId ? 'Tax code updated' : 'Tax code created');
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the tax code.');
      },
    };

    if (this.editingId) {
      this.proxy
        .update_tax_code(this.editingId, {
          name: this.form.name.trim(),
          rate: rate.toFixed(4),
          account_id: this.form.account_id || undefined,
          is_active: this.form.is_active,
        })
        .subscribe(done);
    } else {
      this.proxy
        .create_tax_code({
          code: this.form.code.trim(),
          name: this.form.name.trim(),
          rate: rate.toFixed(4),
          direction: this.form.direction,
          account_id: this.form.account_id || undefined,
        })
        .subscribe(done);
    }
  }

  private async remove(t: AccountingTaxCode): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Delete ${t.code}?`,
      message: 'System tax codes cannot be deleted; deactivate them instead.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.proxy.delete_tax_code(t.id).subscribe({
      next: () => {
        this.notify.success('Tax code deleted');
        this.reload();
      },
      error: (err: unknown) => this.notify.error(apiErrorInfo(err).message || 'Delete failed'),
    });
  }
}
