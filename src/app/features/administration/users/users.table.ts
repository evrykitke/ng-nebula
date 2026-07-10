import { RowAction, TableConfig, col } from '../../../shared/datatable/table-config';
import { Profile } from '../../../shared/service-proxies/service-proxies';

/**
 * DataTable configuration for the Users list. Columns, sorting, search and the
 * available row actions are declared here; the page supplies the data source
 * and reacts to emitted actions. Actions are permission-gated by the caller.
 */
export function usersTable(opts: {
  canManageAccess: boolean;
  canEdit: boolean;
}): TableConfig<Profile> {
  const actions: RowAction<Profile>[] = [];
  if (opts.canManageAccess) {
    actions.push({ key: 'access', label: 'Roles & permissions' });
  }
  if (opts.canEdit) {
    actions.push({
      key: 'make-admin',
      label: 'Make admin',
      visible: (u) => !u.is_tenant_admin,
    });
    actions.push({
      key: 'remove-admin',
      label: 'Remove admin',
      tone: 'danger',
      visible: (u) => u.is_tenant_admin,
    });
  }

  return {
    id: 'users',
    rowKey: (u) => String(u.id),
    columns: [
      col.text<Profile>('user_name', 'Username').sortable(),
      col
        .text<Profile>('first_name', 'Name')
        .value((u) => `${u.first_name} ${u.last_name}`.trim())
        .sortable(),
      col.email<Profile>('email', 'Email').sortable(),
      col
        .badge<Profile>('is_tenant_admin', 'Role')
        .value((u) => (u.is_tenant_admin ? 'Admin' : 'Member'))
        .badgeColors({ Admin: 'info', Member: 'muted' }),
      col
        .boolean<Profile>('two_factor_enabled', '2FA')
        .badgeColors({ true: 'success', false: 'muted' })
        .hidden(),
      col
        .badge<Profile>('is_active', 'Status')
        .value((u) => (u.is_active ? 'Active' : 'Inactive'))
        .badgeColors({ Active: 'success', Inactive: 'muted' }),
      col.datetime<Profile>('created_at', 'Created').sortable().hidden(),
    ],
    defaultSort: 'user_name',
    defaultSortDir: 'asc',
    pageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
    search: true,
    searchPlaceholder: 'Search users…',
    columnToggle: true,
    actions,
    emptyText: 'No users found.',
  };
}
