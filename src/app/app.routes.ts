import { Routes } from '@angular/router';
import { AppShell } from './core/layout/app-shell/app-shell';
import { authGuard } from './core/auth/auth-guard';
import { permissionGuard } from './core/auth/permission-guard';
import { Permissions } from './core/auth/permissions.constants';

/**
 * Top-level routes. The login route lives outside the shell; feature areas
 * mount as lazy children of the shell behind the auth guard, and
 * permission-gated pages add `permissionGuard` with a `data.permission`.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./core/auth/pages/login/login').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./core/auth/pages/register/register').then((m) => m.RegisterPage),
  },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'workspace/reports',
        loadComponent: () =>
          import('./features/workspace/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'workspace/reports/:name',
        loadComponent: () =>
          import('./features/workspace/report-viewer.page').then((m) => m.ReportViewerPage),
      },
      {
        path: 'accounting/accounts',
        canActivate: [permissionGuard],
        data: { permission: Permissions.accountsView },
        loadComponent: () =>
          import('./features/accounting/accounts/accounts.page').then((m) => m.AccountsPage),
      },
      {
        path: 'accounting/accounts/:id/ledger',
        canActivate: [permissionGuard],
        data: { permission: Permissions.accountingReportsView },
        loadComponent: () =>
          import('./features/accounting/ledger/account-ledger.page').then(
            (m) => m.AccountLedgerPage,
          ),
      },
      {
        path: 'accounting/fiscal-years',
        canActivate: [permissionGuard],
        data: { permission: Permissions.fiscalYearsView },
        loadComponent: () =>
          import('./features/accounting/fiscal-years/fiscal-years.page').then(
            (m) => m.FiscalYearsPage,
          ),
      },
      {
        path: 'accounting/journal',
        canActivate: [permissionGuard],
        data: { permission: Permissions.journalView },
        loadComponent: () =>
          import('./features/accounting/journal/journal.page').then((m) => m.JournalPage),
      },
      {
        path: 'accounting/journal/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.journalCreate },
        loadComponent: () =>
          import('./features/accounting/journal/journal-entry-new.page').then(
            (m) => m.JournalEntryNewPage,
          ),
      },
      {
        path: 'accounting/journal/:id/edit',
        canActivate: [permissionGuard],
        data: { permission: Permissions.journalCreate },
        loadComponent: () =>
          import('./features/accounting/journal/journal-entry-new.page').then(
            (m) => m.JournalEntryNewPage,
          ),
      },
      {
        path: 'accounting/journal/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.journalView },
        loadComponent: () =>
          import('./features/accounting/journal/journal-entry-detail.page').then(
            (m) => m.JournalEntryDetailPage,
          ),
      },
      {
        path: 'accounting/expenses',
        canActivate: [permissionGuard],
        data: { permission: Permissions.expensesView },
        loadComponent: () =>
          import('./features/accounting/expenses/expenses.page').then((m) => m.ExpensesPage),
      },
      {
        path: 'accounting/tax-codes',
        canActivate: [permissionGuard],
        data: { permission: Permissions.taxView },
        loadComponent: () =>
          import('./features/accounting/tax-codes/tax-codes.page').then((m) => m.TaxCodesPage),
      },
      {
        path: 'accounting/trial-balance',
        canActivate: [permissionGuard],
        data: { permission: Permissions.accountingReportsView },
        loadComponent: () =>
          import('./features/accounting/trial-balance/trial-balance.page').then(
            (m) => m.TrialBalancePage,
          ),
      },
      {
        path: 'accounting/balance-sheet',
        canActivate: [permissionGuard],
        data: { permission: Permissions.accountingReportsView },
        loadComponent: () =>
          import('./features/accounting/balance-sheet/balance-sheet.page').then(
            (m) => m.BalanceSheetPage,
          ),
      },
      {
        path: 'accounting/income-statement',
        canActivate: [permissionGuard],
        data: { permission: Permissions.accountingReportsView },
        loadComponent: () =>
          import('./features/accounting/income-statement/income-statement.page').then(
            (m) => m.IncomeStatementPage,
          ),
      },
      {
        path: 'administration',
        loadComponent: () =>
          import('./features/administration/administration-hub.page').then(
            (m) => m.AdministrationHubPage,
          ),
      },
      {
        path: 'administration/users',
        canActivate: [permissionGuard],
        data: { permission: Permissions.usersView },
        loadComponent: () =>
          import('./features/administration/users/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'administration/users/:id/permissions',
        canActivate: [permissionGuard],
        data: { permission: Permissions.usersPermissions },
        loadComponent: () =>
          import('./features/administration/users/user-permissions.page').then(
            (m) => m.UserPermissionsPage,
          ),
      },
      {
        path: 'administration/roles',
        canActivate: [permissionGuard],
        data: { permission: Permissions.rolesView },
        loadComponent: () =>
          import('./features/administration/roles/roles.page').then((m) => m.RolesPage),
      },
      {
        path: 'administration/audit-logs',
        canActivate: [permissionGuard],
        data: { permission: Permissions.auditLogsView },
        loadComponent: () =>
          import('./features/administration/audit-logs/audit-logs.page').then(
            (m) => m.AuditLogsPage,
          ),
      },
      {
        path: 'administration/audit-logs/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.auditLogsView },
        loadComponent: () =>
          import('./features/administration/audit-logs/audit-log-detail.page').then(
            (m) => m.AuditLogDetailPage,
          ),
      },
      {
        path: 'administration/settings',
        canActivate: [permissionGuard],
        data: { permission: Permissions.tenantSettings },
        loadComponent: () =>
          import('./features/administration/settings/tenant-settings.page').then(
            (m) => m.TenantSettingsPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
