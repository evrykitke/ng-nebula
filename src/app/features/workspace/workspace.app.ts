/**
 * The Workspace app: Home: the dashboard, the report catalogue, and the launcher for everything else.
 *
 * Its menu and its pages, in one place, beside the pages themselves. The shell
 * composes whatever apps it is given — see `core/layout/app.model`.
 */
import { defineApp } from '../../core/layout/app.model';

export const WORKSPACE_APP = defineApp({
  nav: {
  label: 'Workspace',
  // A house, not the launcher's grid: the two sit one above the other in the
  // sidebar, and the same glyph twice tells you nothing about either.
  icon: 'lucideHouse',
  exact: false,
  app: true,
  home: true,
  tone: 'sky',
  description:
    "Work that spans the business: the dashboard and the report catalogue.",
  children: [
    { label: 'Reports', icon: 'lucideFileText', route: '/workspace/reports' },
  ],
  },
  routes: [
    {
      path: 'workspace/reports',
      loadComponent: () =>
        import('./reports.page').then((m) => m.ReportsPage),
    },
    {
      path: 'workspace/reports/:name',
      loadComponent: () =>
        import('./report-viewer.page').then((m) => m.ReportViewerPage),
    },
    {
      path: 'apps',
      loadComponent: () => import('./apps.page').then((m) => m.AppsPage),
    },
    {
      path: 'dashboard',
      loadComponent: () =>
        import('../dashboard/dashboard.page').then((m) => m.DashboardPage),
    },
  ],
});
