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
import { usersTable } from './users.table';
import {
  AuthServiceProxy,
  CreateUserRequest,
  Profile,
} from '../../../shared/service-proxies/service-proxies';

/** User management: a searchable data table with create and admin toggle. */
@Component({
  selector: 'app-users-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader, DataTable, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users.page.html',
})
export class UsersPage {
  private readonly proxy = inject(AuthServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  private readonly table = viewChild<DataTable<Profile>>(DataTable);

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.usersCreate));
  readonly canEdit = computed(() => this.auth.hasPermission(Permissions.usersEdit));
  readonly canManageAccess = computed(() =>
    this.auth.hasPermission(Permissions.usersPermissions),
  );

  readonly tableConfig = computed(() =>
    usersTable({ canManageAccess: this.canManageAccess(), canEdit: this.canEdit() }),
  );

  /** The list endpoint returns everyone; search/sort/paging happen client-side. */
  readonly dataSource: TableDataSource<Profile> = clientSideSource(
    () => this.proxy.list_users(),
    (u, term) =>
      u.user_name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(term),
  );

  // Create dialog.
  readonly creating = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  form: CreateUserRequest = this.emptyForm();

  private emptyForm(): CreateUserRequest {
    return {
      user_name: '',
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      is_tenant_admin: false,
    };
  }

  private reload(): void {
    this.table()?.load();
  }

  onAction(event: { key: string; row: Profile }): void {
    switch (event.key) {
      case 'access':
        void this.router.navigate(['/administration/users', event.row.id, 'permissions']);
        break;
      case 'make-admin':
        void this.setAdmin(event.row, true);
        break;
      case 'remove-admin':
        void this.setAdmin(event.row, false);
        break;
    }
  }

  openCreate(): void {
    this.form = this.emptyForm();
    this.formError.set(null);
    this.creating.set(true);
  }

  create(): void {
    if (this.saving()) return;
    if (
      !this.form.user_name.trim() ||
      !this.form.first_name.trim() ||
      !this.form.last_name.trim() ||
      !this.form.email.trim() ||
      !this.form.password
    ) {
      this.formError.set('All fields are required.');
      return;
    }
    this.saving.set(true);
    this.proxy.create_user(this.form).subscribe({
      next: () => {
        this.saving.set(false);
        this.creating.set(false);
        this.notify.success('User created');
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not create the user.');
      },
    });
  }

  private async setAdmin(user: Profile, isAdmin: boolean): Promise<void> {
    const name = `${user.first_name} ${user.last_name}`.trim() || user.user_name;
    const ok = await this.confirm.ask({
      title: isAdmin ? `Make ${name} an admin?` : `Remove ${name}'s admin role?`,
      message: isAdmin
        ? 'Admins implicitly hold every permission in the workspace.'
        : 'The user keeps only the permissions their remaining roles grant.',
      confirmText: isAdmin ? 'Make admin' : 'Remove admin',
      tone: isAdmin ? 'default' : 'danger',
    });
    if (!ok) return;
    this.proxy.set_user_admin(user.id, { is_admin: isAdmin }).subscribe({
      next: () => {
        this.notify.success(isAdmin ? 'Admin role granted' : 'Admin role removed');
        this.reload();
      },
      error: (err: unknown) => this.notify.error(apiErrorInfo(err).message || 'Update failed'),
    });
  }
}
