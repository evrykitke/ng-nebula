import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { map } from 'rxjs';
import { UiButton } from '../../../shared/ui/button';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { AuthService } from '../../../core/auth/auth.service';
import { Permissions } from '../../../core/auth/permissions.constants';
import { DataTable } from '../../../shared/datatable/data-table';
import { TableDataSource } from '../../../shared/datatable/table-config';
import { clientSideSource } from '../../../shared/datatable/client-side';
import { journalTable } from './journal.table';
import {
  AccountingServiceProxy,
  EntryStatus,
  JournalEntryHeader,
} from '../../../shared/service-proxies/service-proxies';

/** The journal register: every draft, posted and reversed entry, newest first. */
@Component({
  selector: 'app-journal-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './journal.page.html',
})
export class JournalPage {
  private readonly proxy = inject(AccountingServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly table = viewChild<DataTable<JournalEntryHeader>>(DataTable);

  readonly statuses: EntryStatus[] = ['draft', 'posted', 'reversed'];
  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.journalCreate));

  readonly tableConfig = journalTable();

  /** Projected status filter, applied server-side via the list endpoint. */
  statusFilter: '' | EntryStatus = '';

  readonly dataSource: TableDataSource<JournalEntryHeader> = clientSideSource(
    () =>
      this.proxy
        .list_entries(this.statusFilter || undefined)
        .pipe(map((rows) => rows ?? [])),
    (e, term) =>
      (e.number ?? '').toLowerCase().includes(term) ||
      e.memo.toLowerCase().includes(term) ||
      (e.reference ?? '').toLowerCase().includes(term),
  );

  applyFilters(): void {
    this.table()?.load();
  }

  newEntry(): void {
    void this.router.navigate(['/accounting/journal/new']);
  }

  onAction(event: { key: string; row: JournalEntryHeader }): void {
    if (event.key === 'view') {
      void this.router.navigate(['/accounting/journal', event.row.id]);
    }
  }
}
