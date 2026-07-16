/**
 * The Accounting app: The books: the chart of accounts, the journal, tax, and the statements they add up to.
 *
 * Its menu and its pages, in one place, beside the pages themselves. The shell
 * composes whatever apps it is given — see `core/layout/app.model`.
 */
import { defineApp } from '../../core/layout/app.model';
import { permissionGuard } from '../../core/auth/permission-guard';
import { Permissions } from '../../core/auth/permissions.constants';

export const ACCOUNTING_APP = defineApp({
  nav: {
  label: 'Accounting',
  icon: 'lucideCalculator',
  exact: false,
  app: true,
  tone: 'indigo',
  description:
    "The books — accounts, journals, tax, and the statements they add up to.",
  children: [
    { label: 'Dashboard', icon: 'lucideChartColumn', route: '/accounting/dashboard' },
    {
      label: 'Chart of Accounts',
      icon: 'lucideListTree',
      route: '/accounting/accounts',
      permission: Permissions.accountsView,
    },
    {
      label: 'Fiscal Years',
      icon: 'lucideCalendarRange',
      route: '/accounting/fiscal-years',
      permission: Permissions.fiscalYearsView,
    },
    {
      label: 'Journal',
      icon: 'lucideBookText',
      route: '/accounting/journal',
      permission: Permissions.journalView,
    },
    {
      label: 'Expenses',
      icon: 'lucideReceipt',
      route: '/accounting/expenses',
      permission: Permissions.expensesView,
    },
    {
      label: 'Tax Codes',
      icon: 'lucidePercent',
      route: '/accounting/tax-codes',
      permission: Permissions.taxView,
    },
    {
      label: 'Trial Balance',
      icon: 'lucideScale',
      route: '/accounting/trial-balance',
      permission: Permissions.accountingReportsView,
    },
    {
      label: 'Balance Sheet',
      icon: 'lucideLayers',
      route: '/accounting/balance-sheet',
      permission: Permissions.accountingReportsView,
    },
    {
      label: 'Income Statement',
      icon: 'lucideTrendingUp',
      route: '/accounting/income-statement',
      permission: Permissions.accountingReportsView,
    },
  ],
  },
  routes: [
    {
      path: 'accounting/dashboard',
      loadComponent: () =>
        import('../shared/module-dashboard.page').then((m) => m.ModuleDashboardPage),
    },
    {
      path: 'accounting/accounts',
      canActivate: [permissionGuard],
      data: { permission: Permissions.accountsView },
      loadComponent: () =>
        import('./accounts/accounts.page').then((m) => m.AccountsPage),
    },
    {
      path: 'accounting/accounts/:id/ledger',
      canActivate: [permissionGuard],
      data: { permission: Permissions.accountingReportsView },
      loadComponent: () =>
        import('./ledger/account-ledger.page').then(
          (m) => m.AccountLedgerPage,
        ),
    },
    {
      path: 'accounting/fiscal-years',
      canActivate: [permissionGuard],
      data: { permission: Permissions.fiscalYearsView },
      loadComponent: () =>
        import('./fiscal-years/fiscal-years.page').then(
          (m) => m.FiscalYearsPage,
        ),
    },
    {
      path: 'accounting/journal',
      canActivate: [permissionGuard],
      data: { permission: Permissions.journalView },
      loadComponent: () =>
        import('./journal/journal.page').then((m) => m.JournalPage),
    },
    {
      path: 'accounting/journal/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.journalCreate },
      loadComponent: () =>
        import('./journal/journal-entry-new.page').then(
          (m) => m.JournalEntryNewPage,
        ),
    },
    {
      path: 'accounting/journal/:id/edit',
      canActivate: [permissionGuard],
      data: { permission: Permissions.journalCreate },
      loadComponent: () =>
        import('./journal/journal-entry-new.page').then(
          (m) => m.JournalEntryNewPage,
        ),
    },
    {
      path: 'accounting/journal/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.journalView },
      loadComponent: () =>
        import('./journal/journal-entry-detail.page').then(
          (m) => m.JournalEntryDetailPage,
        ),
    },
    {
      path: 'accounting/expenses',
      canActivate: [permissionGuard],
      data: { permission: Permissions.expensesView },
      loadComponent: () =>
        import('./expenses/expenses.page').then((m) => m.ExpensesPage),
    },
    {
      path: 'accounting/tax-codes',
      canActivate: [permissionGuard],
      data: { permission: Permissions.taxView },
      loadComponent: () =>
        import('./tax-codes/tax-codes.page').then((m) => m.TaxCodesPage),
    },
    {
      path: 'accounting/trial-balance',
      canActivate: [permissionGuard],
      data: { permission: Permissions.accountingReportsView },
      loadComponent: () =>
        import('./trial-balance/trial-balance.page').then(
          (m) => m.TrialBalancePage,
        ),
    },
    {
      path: 'accounting/balance-sheet',
      canActivate: [permissionGuard],
      data: { permission: Permissions.accountingReportsView },
      loadComponent: () =>
        import('./balance-sheet/balance-sheet.page').then(
          (m) => m.BalanceSheetPage,
        ),
    },
    {
      path: 'accounting/income-statement',
      canActivate: [permissionGuard],
      data: { permission: Permissions.accountingReportsView },
      loadComponent: () =>
        import('./income-statement/income-statement.page').then(
          (m) => m.IncomeStatementPage,
        ),
    },
  ],
});
