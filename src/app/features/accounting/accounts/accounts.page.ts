import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { map, tap } from 'rxjs';
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
import { accountsTable } from './accounts.table';
import {
  AccountingAccount,
  AccountingServiceProxy,
  AccountType,
  CreateAccountRequest,
} from '../../../shared/service-proxies/service-proxies';

const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

/** Chart of Accounts: a searchable, type-filterable list with create/edit/delete. */
@Component({
  selector: 'app-accounts-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader, DataTable, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accounts.page.html',
})
export class AccountsPage {
  private readonly proxy = inject(AccountingServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  private readonly table = viewChild<DataTable<AccountingAccount>>(DataTable);

  readonly accountTypes = ACCOUNT_TYPES;

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.accountsCreate));
  readonly canEdit = computed(() => this.auth.hasPermission(Permissions.accountsEdit));
  readonly canDelete = computed(() => this.auth.hasPermission(Permissions.accountsDelete));
  readonly canViewLedger = computed(() =>
    this.auth.hasPermission(Permissions.accountingReportsView),
  );

  readonly tableConfig = computed(() =>
    accountsTable({
      canEdit: this.canEdit(),
      canDelete: this.canDelete(),
      canViewLedger: this.canViewLedger(),
    }),
  );

  /** Projected type filter (applied in-memory on top of the full list). */
  typeFilter = '';
  /** All accounts, cached for the parent picker and the currency default. */
  private readonly accounts = signal<AccountingAccount[]>([]);

  readonly dataSource: TableDataSource<AccountingAccount> = clientSideSource(
    () =>
      this.proxy.list_accounts().pipe(
        // Cache the full list (parent picker, currency default), then apply the
        // projected type filter in memory.
        tap((all) => this.accounts.set(all)),
        map((all) =>
          this.typeFilter ? all.filter((a) => a.account_type === this.typeFilter) : all,
        ),
      ),
    (a, term) => a.code.toLowerCase().includes(term) || a.name.toLowerCase().includes(term),
  );

  /** Top-level accounts of the currently selected type, for the parent picker. */
  readonly parentOptions = computed(() => this.accounts());

  applyFilters(): void {
    this.table()?.load();
  }

  // Create / edit dialog.
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  editingId: string | null = null;
  form = this.emptyForm();

  private emptyForm(): CreateAccountRequest & { is_active: boolean } {
    return {
      code: '',
      name: '',
      account_type: 'asset',
      currency: this.defaultCurrency(),
      parent_id: '',
      description: '',
      is_active: true,
    };
  }

  private defaultCurrency(): string {
    return this.accounts()[0]?.currency ?? 'USD';
  }

  private reload(): void {
    this.table()?.load();
  }

  onAction(event: { key: string; row: AccountingAccount }): void {
    switch (event.key) {
      case 'ledger':
        void this.router.navigate(['/accounting/accounts', event.row.id, 'ledger']);
        break;
      case 'edit':
        this.openEdit(event.row);
        break;
      case 'delete':
        void this.remove(event.row);
        break;
    }
  }

  openCreate(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.formError.set(null);
    this.editing.set(true);
  }

  openEdit(a: AccountingAccount): void {
    this.editingId = a.id;
    this.form = {
      code: a.code,
      name: a.name,
      account_type: a.account_type as AccountType,
      currency: a.currency,
      parent_id: a.parent_id ?? '',
      description: a.description ?? '',
      is_active: a.is_active,
    };
    this.formError.set(null);
    this.editing.set(true);
  }

  save(): void {
    if (this.saving()) return;
    if (!this.editingId && (!this.form.code.trim() || !this.form.currency.trim())) {
      this.formError.set('Code and currency are required.');
      return;
    }
    if (!this.form.name.trim()) {
      this.formError.set('Name is required.');
      return;
    }
    this.saving.set(true);

    const done = {
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.notify.success(this.editingId ? 'Account updated' : 'Account created');
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the account.');
      },
    };

    if (this.editingId) {
      this.proxy
        .update_account(this.editingId, {
          name: this.form.name.trim(),
          description: this.form.description?.trim() || undefined,
          is_active: this.form.is_active,
        })
        .subscribe(done);
    } else {
      this.proxy
        .create_account({
          code: this.form.code.trim(),
          name: this.form.name.trim(),
          account_type: this.form.account_type,
          currency: this.form.currency.trim().toUpperCase(),
          parent_id: this.form.parent_id || undefined,
          description: this.form.description?.trim() || undefined,
        })
        .subscribe(done);
    }
  }

  private async remove(a: AccountingAccount): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Delete ${a.code} — ${a.name}?`,
      message: 'Accounts with postings or child accounts cannot be deleted.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.proxy.delete_account(a.id).subscribe({
      next: () => {
        this.notify.success('Account deleted');
        this.reload();
      },
      error: (err: unknown) => this.notify.error(apiErrorInfo(err).message || 'Delete failed'),
    });
  }
}
