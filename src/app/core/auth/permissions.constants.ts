/**
 * Permission names, mirroring the backend's permission tree
 * (`Pages.Administration...`). Keep in sync with the definitions the
 * server exposes at `GET /auth/permissions`.
 */
export const Permissions = {
  administration: 'Pages.Administration',
  usersView: 'Pages.Administration.Users.View',
  usersCreate: 'Pages.Administration.Users.Create',
  usersEdit: 'Pages.Administration.Users.Edit',
  usersDelete: 'Pages.Administration.Users.Delete',
  usersPermissions: 'Pages.Administration.Users.Permissions',
  rolesView: 'Pages.Administration.Roles.View',
  rolesCreate: 'Pages.Administration.Roles.Create',
  rolesEdit: 'Pages.Administration.Roles.Edit',
  rolesDelete: 'Pages.Administration.Roles.Delete',
  tenantSettings: 'Pages.Administration.Tenant.Settings',
  auditLogsView: 'Pages.Administration.AuditLogs.View',
} as const;
