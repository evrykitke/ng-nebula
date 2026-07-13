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

  accounting: 'Pages.Accounting',
  fiscalYearsView: 'Pages.Accounting.FiscalYears.View',
  fiscalYearsManage: 'Pages.Accounting.FiscalYears.Manage',
  accountsView: 'Pages.Accounting.Accounts.View',
  accountsCreate: 'Pages.Accounting.Accounts.Create',
  accountsEdit: 'Pages.Accounting.Accounts.Edit',
  accountsDelete: 'Pages.Accounting.Accounts.Delete',
  journalView: 'Pages.Accounting.Journal.View',
  journalCreate: 'Pages.Accounting.Journal.Create',
  journalPost: 'Pages.Accounting.Journal.Post',
  journalReverse: 'Pages.Accounting.Journal.Reverse',
  expensesView: 'Pages.Accounting.Expenses.View',
  expensesRecord: 'Pages.Accounting.Expenses.Record',
  taxView: 'Pages.Accounting.Tax.View',
  taxCreate: 'Pages.Accounting.Tax.Create',
  taxEdit: 'Pages.Accounting.Tax.Edit',
  taxDelete: 'Pages.Accounting.Tax.Delete',
  accountingReportsView: 'Pages.Accounting.Reports.View',
} as const;
