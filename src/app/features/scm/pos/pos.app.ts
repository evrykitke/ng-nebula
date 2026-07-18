/**
 * The Point of Sale app: the counter itself, and the desk behind it.
 *
 * The till is deliberately NOT here — it is a full-screen page outside the
 * app shell (`/pos/till`, see `TILL_ROUTES` and `app.routes.ts`): a cashier
 * mid-queue has no use for a sidebar, and the till's layout obeys its own
 * rules (see pylonImlementation/pos/02-ui-ux-research.md). What this app
 * carries is everything one does about the till from a desk: registers,
 * sessions, receipts, reports, settings — plus the launcher tile that steps
 * out to the counter.
 */
import { Routes } from '@angular/router';
import { defineApp } from '../../../core/layout/app.model';
import { authGuard } from '../../../core/auth/auth-guard';
import { permissionGuard } from '../../../core/auth/permission-guard';
import { Permissions } from '../../../core/auth/permissions.constants';

export const POS_APP = defineApp({
  nav: {
    label: 'Point of Sale',
    icon: 'lucideShoppingCart',
    exact: false,
    app: true,
    tone: 'violet',
    description:
      'The counter — fast tills that consolidate into one movement and one ledger entry per session.',
    children: [
      { label: 'Dashboard', icon: 'lucideChartColumn', route: '/pos/dashboard' },
      {
        label: 'Open Till',
        icon: 'lucideMonitor',
        route: '/pos/till',
        permission: Permissions.posSell,
      },
      {
        label: 'Receipts',
        icon: 'lucideReceipt',
        route: '/pos/receipts',
        permission: Permissions.posSell,
      },
      {
        label: 'Sessions',
        icon: 'lucideHistory',
        route: '/pos/sessions',
        permission: Permissions.posReportsView,
      },
      {
        label: 'Registers',
        icon: 'lucideCalculator',
        route: '/pos/registers',
        permission: Permissions.posRegistersView,
      },
      {
        label: 'Reports',
        icon: 'lucideChartColumn',
        route: '/pos/reports',
        permission: Permissions.posReportsView,
      },
      {
        label: 'Settings',
        icon: 'lucideSettings',
        route: '/pos/settings',
        permission: Permissions.posRegistersManage,
      },
    ],
  },
  routes: [
    {
      path: 'pos/dashboard',
      loadComponent: () =>
        import('../../shared/module-dashboard.page').then((m) => m.ModuleDashboardPage),
    },
    {
      path: 'pos/receipts',
      canActivate: [permissionGuard],
      data: { permission: Permissions.posSell },
      loadComponent: () => import('./receipts/receipts.page').then((m) => m.ReceiptsPage),
    },
    {
      path: 'pos/receipts/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.posSell },
      loadComponent: () =>
        import('./receipts/receipt-detail.page').then((m) => m.ReceiptDetailPage),
    },
    {
      path: 'pos/sessions',
      canActivate: [permissionGuard],
      data: { permission: Permissions.posReportsView },
      loadComponent: () => import('./sessions/sessions.page').then((m) => m.SessionsPage),
    },
    {
      path: 'pos/sessions/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.posReportsView },
      loadComponent: () =>
        import('./sessions/session-detail.page').then((m) => m.SessionDetailPage),
    },
    {
      path: 'pos/registers',
      canActivate: [permissionGuard],
      data: { permission: Permissions.posRegistersView },
      loadComponent: () => import('./registers/registers.page').then((m) => m.RegistersPage),
    },
    {
      path: 'pos/reports',
      canActivate: [permissionGuard],
      data: { permission: Permissions.posReportsView },
      loadComponent: () => import('./reports/pos-reports.page').then((m) => m.PosReportsPage),
    },
    {
      path: 'pos/settings',
      canActivate: [permissionGuard],
      data: { permission: Permissions.posRegistersManage },
      loadComponent: () => import('./settings/pos-settings.page').then((m) => m.PosSettingsPage),
    },
  ],
});

/**
 * The till's own route, mounted at the top level beside `login` rather than
 * inside the shell: the counter takes the whole screen.
 */
export const TILL_ROUTES: Routes = [
  {
    path: 'pos/till',
    canActivate: [authGuard, permissionGuard],
    data: { permission: Permissions.posSell },
    loadComponent: () => import('./till/till.page').then((m) => m.TillPage),
  },
];
