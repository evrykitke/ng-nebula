import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { DateTime } from 'luxon';
import { switchMap } from 'rxjs';
import { of } from 'rxjs';
import { UiButton } from '../../../shared/ui/button';
import { UiDatepicker } from '../../../shared/ui/datepicker';
import { Lookup } from '../../../shared/lookup/lookup';
import { LookupConfig } from '../../../shared/lookup/lookup-config';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { AuthService } from '../../../core/auth/auth.service';
import { Permissions } from '../../../core/auth/permissions.constants';
import { NotificationService } from '../../../core/services/notification.service';
import { apiErrorInfo } from '../../../shared/api/api-error';
import {
  AccountingAccount,
  AccountingServiceProxy,
  CreateEntryRequest,
  JournalEntryView,
  PostingInputRequest,
} from '../../../shared/service-proxies/service-proxies';

interface EntryLine {
  account_id: string;
  account_label: string;
  memo: string;
  debit: string;
  credit: string;
}

/**
 * Compose a balanced draft journal entry and optionally post it in one
 * step. Also serves as the draft editor (route `journal/:id/edit`): the
 * draft is loaded into the same form and saved via update.
 */
@Component({
  selector: 'app-journal-entry-new-page',
  imports: [FormsModule, RouterLink, NgIcon, UiButton, UiDatepicker, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './journal-entry-new.page.html',
})
export class JournalEntryNewPage {
  private readonly proxy = inject(AccountingServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly canPost = computed(() => this.auth.hasPermission(Permissions.journalPost));

  /** The draft being edited, or null when composing a new entry. */
  readonly editId = signal<string | null>(null);

  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  form = {
    entry_date: DateTime.now() as DateTime | undefined,
    memo: '',
    reference: '',
    currency: 'USD',
  };

  readonly lines = signal<EntryLine[]>([this.blankLine(), this.blankLine()]);

  /** Postable (leaf, active) accounts in the entry currency. */
  readonly accounts = signal<AccountingAccount[]>([]);
  readonly postableAccounts = computed(() => {
    const all = this.accounts();
    const parentIds = new Set(all.map((a) => a.parent_id).filter(Boolean));
    const ccy = this.form.currency.trim().toUpperCase();
    return all.filter(
      (a) => a.is_active && !parentIds.has(a.id) && (!ccy || a.currency === ccy),
    );
  });

  /** Searchable account picker over the postable accounts (client-filtered). */
  readonly accountLookup = computed<LookupConfig<AccountingAccount>>(() => {
    const rows = this.postableAccounts();
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
      placeholder: 'Select account…',
      searchPlaceholder: 'Search code or name…',
      emptyText: 'No accounts match.',
    };
  });

  readonly totals = computed(() => {
    let debit = 0;
    let credit = 0;
    let withAccount = 0;
    for (const l of this.lines()) {
      debit += Number(l.debit) || 0;
      credit += Number(l.credit) || 0;
      if (l.account_id) withAccount++;
    }
    const balanced =
      withAccount >= 2 && debit > 0 && Math.abs(debit - credit) < 0.005;
    return { debit, credit, balanced };
  });

  constructor() {
    const editId = this.route.snapshot.paramMap.get('id');
    this.editId.set(editId);

    this.proxy.list_accounts().subscribe({
      next: (all) => {
        this.accounts.set(all ?? []);
        // Default the entry currency to the tenant's chart currency.
        const first = (all ?? [])[0];
        if (first && !editId) this.form.currency = first.currency;
      },
      error: (err) => this.notify.error('Could not load accounts', apiErrorInfo(err).message),
    });

    if (editId) this.loadDraft(editId);
  }

  /** Prefill the form from an existing draft; anything else is immutable. */
  private loadDraft(id: string): void {
    this.proxy.get_entry(id).subscribe({
      next: (e) => {
        if (e.status !== 'draft') {
          this.notify.error('Only a draft can be edited');
          void this.router.navigate(['/accounting/journal', id]);
          return;
        }
        this.form = {
          entry_date: e.entry_date,
          memo: e.memo,
          reference: e.reference ?? '',
          currency: e.currency,
        };
        this.lines.set(
          e.lines.map((l) => ({
            account_id: l.account_id,
            account_label: `${l.account_code} — ${l.account_name}`,
            memo: l.memo ?? '',
            debit: Number(l.debit) > 0 ? String(Number(l.debit)) : '',
            credit: Number(l.credit) > 0 ? String(Number(l.credit)) : '',
          })),
        );
      },
      error: (err) => {
        this.notify.error('Could not load the draft', apiErrorInfo(err).message);
        void this.router.navigate(['/accounting/journal']);
      },
    });
  }

  private blankLine(): EntryLine {
    return { account_id: '', account_label: '', memo: '', debit: '', credit: '' };
  }

  addLine(): void {
    this.lines.update((ls) => [...ls, this.blankLine()]);
  }

  removeLine(i: number): void {
    this.lines.update((ls) => ls.filter((_, idx) => idx !== i));
  }

  onAccountSelected(line: EntryLine, account: AccountingAccount): void {
    line.account_id = account.id;
    line.account_label = `${account.code} — ${account.name}`;
    this.onAmount();
  }

  /** Keeps the line's key in sync, including when the lookup is cleared. */
  onAccountValue(line: EntryLine, value: string | null): void {
    line.account_id = value ?? '';
    if (!value) line.account_label = '';
    this.onAmount();
  }

  saveDraft(): void {
    this.submit(false);
  }

  savePost(): void {
    this.submit(true);
  }

  private submit(post: boolean): void {
    if (this.saving()) return;
    const body = this.buildRequest();
    if (!body) return;

    this.saving.set(true);
    const editId = this.editId();
    const save$ = editId ? this.proxy.update_entry(editId, body) : this.proxy.create_entry(body);
    const flow$ = post
      ? save$.pipe(switchMap((view: JournalEntryView) => this.proxy.post_entry(view.id)))
      : save$;

    flow$.subscribe({
      next: (view) => {
        this.saving.set(false);
        this.notify.success(post ? 'Entry posted' : 'Draft saved');
        void this.router.navigate(['/accounting/journal', view.id]);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the entry.');
      },
    });
  }

  private buildRequest(): CreateEntryRequest | null {
    this.formError.set(null);
    const currency = this.form.currency.trim().toUpperCase();
    if (!currency) {
      this.formError.set('Currency is required.');
      return null;
    }
    const entryDate = this.form.entry_date;
    if (!entryDate || !entryDate.isValid) {
      this.formError.set('A valid date is required.');
      return null;
    }
    const lines: PostingInputRequest[] = [];
    for (const l of this.lines()) {
      const debit = Number(l.debit) || 0;
      const credit = Number(l.credit) || 0;
      if (!l.account_id && debit === 0 && credit === 0) continue; // skip empty rows
      if (!l.account_id) {
        this.formError.set('Every line with an amount needs an account.');
        return null;
      }
      if ((debit > 0) === (credit > 0)) {
        this.formError.set('Each line must have exactly one of debit or credit.');
        return null;
      }
      lines.push({
        account_id: l.account_id,
        debit: debit > 0 ? debit.toFixed(2) : undefined,
        credit: credit > 0 ? credit.toFixed(2) : undefined,
        memo: l.memo.trim() || undefined,
      });
    }
    if (lines.length < 2) {
      this.formError.set('An entry needs at least two lines.');
      return null;
    }
    return {
      currency,
      // Backend expects a NaiveDate ("YYYY-MM-DD"); create_entry JSON.stringifies
      // the body as-is, so a plain date string serializes correctly.
      entry_date: entryDate.toFormat('yyyy-LL-dd') as unknown as DateTime,
      memo: this.form.memo.trim(),
      reference: this.form.reference.trim() || undefined,
      lines,
    };
  }

  onAmount(): void {
    // Trigger totals recompute by re-emitting the lines signal.
    this.lines.update((ls) => [...ls]);
  }
}
