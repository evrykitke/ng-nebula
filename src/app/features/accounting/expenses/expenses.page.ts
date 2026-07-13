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
import { NgIcon } from '@ng-icons/core';
import { DateTime } from 'luxon';
import { of } from 'rxjs';
import { UiButton } from '../../../shared/ui/button';
import { UiDatepicker } from '../../../shared/ui/datepicker';
import { Modal } from '../../../shared/ui/modal';
import { Lookup } from '../../../shared/lookup/lookup';
import { LookupConfig } from '../../../shared/lookup/lookup-config';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { AuthService } from '../../../core/auth/auth.service';
import { Permissions } from '../../../core/auth/permissions.constants';
import { NotificationService } from '../../../core/services/notification.service';
import { DataTable } from '../../../shared/datatable/data-table';
import { TableDataSource } from '../../../shared/datatable/table-config';
import { clientSideSource } from '../../../shared/datatable/client-side';
import { apiErrorInfo } from '../../../shared/api/api-error';
import { expensesTable } from './expenses.table';
import {
  AccountingAccount,
  AccountingServiceProxy,
  AccountingTaxCode,
  JournalEntryHeader,
} from '../../../shared/service-proxies/service-proxies';

/**
 * The expense register plus the "record an expense" dialog: what it was
 * for, how it was paid, the amount and an optional input tax code — the
 * balanced voucher entry is built and posted by the backend.
 */
@Component({
  selector: 'app-expenses-page',
  imports: [FormsModule, NgIcon, UiButton, UiDatepicker, Modal, Lookup, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expenses.page.html',
})
export class ExpensesPage {
  private readonly proxy = inject(AccountingServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  private readonly table = viewChild<DataTable<JournalEntryHeader>>(DataTable);

  readonly canRecord = computed(() => this.auth.hasPermission(Permissions.expensesRecord));

  readonly tableConfig = expensesTable();

  readonly dataSource: TableDataSource<JournalEntryHeader> = clientSideSource(
    () => this.proxy.list_expenses(),
    (e, term) =>
      (e.number ?? '').toLowerCase().includes(term) ||
      e.memo.toLowerCase().includes(term) ||
      (e.reference ?? '').toLowerCase().includes(term),
  );

  readonly accounts = signal<AccountingAccount[]>([]);
  readonly taxCodes = signal<AccountingTaxCode[]>([]);

  /** Active, postable (leaf) accounts of one type. */
  private postable(type: string): AccountingAccount[] {
    const all = this.accounts();
    const parentIds = new Set(all.map((a) => a.parent_id).filter(Boolean));
    return all.filter((a) => a.is_active && !parentIds.has(a.id) && a.account_type === type);
  }

  readonly expenseLookup = computed<LookupConfig<AccountingAccount>>(() =>
    this.accountLookup(this.postable('expense'), 'What was this expense for?'),
  );
  readonly paymentLookup = computed<LookupConfig<AccountingAccount>>(() =>
    this.accountLookup(this.postable('asset'), 'Paid from (cash, bank…)'),
  );

  /** Input (purchase) tax codes only — output codes belong to sales. */
  readonly inputTaxCodes = computed(() =>
    this.taxCodes().filter((t) => t.is_active && t.direction === 'input'),
  );

  private accountLookup(
    rows: AccountingAccount[],
    placeholder: string,
  ): LookupConfig<AccountingAccount> {
    return {
      dataSource: (q) => {
        const s = q.search.trim().toLowerCase();
        const filtered = s
          ? rows.filter(
              (a) => a.code.toLowerCase().includes(s) || a.name.toLowerCase().includes(s),
            )
          : rows;
        return of({ rows: filtered.slice(0, q.size), total: filtered.length });
      },
      columns: [
        { label: 'Code', value: (a) => a.code, width: '90px' },
        { label: 'Name', value: (a) => a.name },
      ],
      key: (a) => a.id,
      display: (a) => `${a.code} — ${a.name}`,
      pageSize: 12,
      placeholder,
      searchPlaceholder: 'Search code or name…',
      emptyText: 'No accounts match.',
    };
  }

  constructor() {
    this.proxy.list_accounts().subscribe({
      next: (all) => this.accounts.set(all ?? []),
      error: () => {},
    });
    this.proxy.list_tax_codes().subscribe({
      next: (all) => this.taxCodes.set(all ?? []),
      error: () => {},
    });
  }

  // Record dialog.
  readonly recording = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  form = this.emptyForm();

  private emptyForm() {
    return {
      entry_date: DateTime.now() as DateTime | undefined,
      memo: '',
      reference: '',
      expense_account_id: '',
      payment_account_id: '',
      amount: '',
      tax_code_id: '',
    };
  }

  /**
   * Tax on the entered amount at the selected code's rate, and the total
   * paid. A method (not a computed) because the form is plain ngModel
   * state: input events trigger change detection, which re-evaluates it.
   */
  preview(): { tax: number; total: number } {
    const amount = Number(this.form.amount) || 0;
    const code = this.taxCodes().find((t) => t.id === this.form.tax_code_id);
    const tax = code ? Math.round(amount * Number(code.rate)) / 100 : 0;
    return { tax, total: amount + tax };
  }

  openRecord(): void {
    this.form = this.emptyForm();
    this.formError.set(null);
    this.recording.set(true);
  }

  save(): void {
    if (this.saving()) return;
    this.formError.set(null);
    const date = this.form.entry_date;
    if (!date || !date.isValid) {
      this.formError.set('A valid date is required.');
      return;
    }
    if (!this.form.memo.trim()) {
      this.formError.set('Say what the expense was for.');
      return;
    }
    if (!this.form.expense_account_id) {
      this.formError.set('Pick the expense account.');
      return;
    }
    if (!this.form.payment_account_id) {
      this.formError.set('Pick the account the money left.');
      return;
    }
    const amount = Number(this.form.amount);
    if (!amount || amount <= 0) {
      this.formError.set('The amount must be greater than zero.');
      return;
    }

    this.saving.set(true);
    this.proxy
      .record_expense({
        // Backend expects a NaiveDate ("YYYY-MM-DD"); the request body is
        // JSON.stringified as-is, so a plain date string serializes correctly.
        entry_date: date.toFormat('yyyy-LL-dd') as unknown as DateTime,
        memo: this.form.memo.trim(),
        reference: this.form.reference.trim() || undefined,
        expense_account_id: this.form.expense_account_id,
        payment_account_id: this.form.payment_account_id,
        amount: amount.toFixed(2),
        tax_code_id: this.form.tax_code_id || undefined,
      })
      .subscribe({
        next: (view) => {
          this.saving.set(false);
          this.recording.set(false);
          this.notify.success(`Expense recorded as ${view.number}`);
          this.table()?.load();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.formError.set(apiErrorInfo(err).message || 'Could not record the expense.');
        },
      });
  }

  onAction(event: { key: string; row: JournalEntryHeader }): void {
    if (event.key === 'view') {
      void this.router.navigate(['/accounting/journal', event.row.id]);
    }
  }

  money(n: number): string {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
