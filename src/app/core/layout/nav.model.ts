import { Permissions } from '../auth/permissions.constants';

/**
 * A single sidebar navigation entry. Supports arbitrary nesting via `children`
 * to drive the multi-level menu.
 */
export interface NavItem {
  label: string;
  /** ng-icon registry name (lucide*), shown in collapsed (icon-only) mode. */
  icon?: string;
  /** Router link for leaf items. Parents with children act as expanders. */
  route?: string;
  children?: NavItem[];
  /** Optional trailing badge (e.g. a count). */
  badge?: string;
  /**
   * Active-match mode for leaf links. Defaults to exact; set `false` for hub
   * routes (e.g. `/administration`) that should stay lit on their subpages.
   */
  exact?: boolean;
  /**
   * Permission(s) gating this item. A single name or an array (any match
   * shows it). Parents without their own permission are shown when at least one
   * child survives filtering.
   */
  permission?: string | string[];
  /**
   * This section is an app — a business module with a life of its own.
   *
   * Classic navigation lists every app at once. App navigation shows one at a
   * time, so the sidebar carries the pages of the work in hand rather than
   * every page in the product. What is an app is a judgement, not a shape:
   * Workspace has children too, and is never one of them — it is home.
   */
  app?: boolean;
  /**
   * An app's colour in the launcher. Apps are told apart at a glance by colour
   * before the label is read, so each owns one — but only in the launcher: a
   * sidebar full of colours is a sidebar you have to read anyway.
   */
  tone?: AppTone;
}

/** The launcher's palette. One per app, and each app keeps its own. */
export type AppTone = 'indigo' | 'amber' | 'violet' | 'emerald' | 'sky' | 'rose';

/**
 * Primary application navigation. Items are filtered by permission at render.
 * Business areas (the ERP modules) mount here as they are built.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'lucideLayoutDashboard', route: '/dashboard' },
  {
    label: 'Accounting',
    icon: 'lucideCalculator',
    exact: false,
    app: true,
    tone: 'indigo',
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
  {
    label: 'Inventory',
    icon: 'lucideBoxes',
    exact: false,
    app: true,
    tone: 'amber',
    children: [
      { label: 'Dashboard', icon: 'lucideChartColumn', route: '/inventory/dashboard' },
      {
        label: 'Items',
        icon: 'lucidePackage',
        route: '/inventory/items',
        permission: Permissions.itemsView,
      },
      {
        label: 'Stock Levels',
        icon: 'lucideLayers',
        route: '/inventory/stock/levels',
        permission: Permissions.itemsView,
      },
      {
        label: 'Movements',
        icon: 'lucideArrowLeftRight',
        route: '/inventory/movements',
        permission: Permissions.movementsView,
      },
      {
        label: 'Stock Ledger',
        icon: 'lucideHistory',
        route: '/inventory/stock/ledger',
        permission: Permissions.inventoryReportsView,
      },
      {
        label: 'Warehouses',
        icon: 'lucideWarehouse',
        route: '/inventory/warehouses',
        permission: Permissions.warehousesView,
      },
      {
        label: 'GL Reconciliation',
        icon: 'lucideScale',
        route: '/inventory/reconciliation',
        permission: Permissions.inventoryReportsView,
      },
      {
        label: 'Setup',
        icon: 'lucideSettings',
        route: '/inventory/setup',
        permission: Permissions.itemsView,
      },
    ],
  },
  {
    label: 'Procurement',
    icon: 'lucideShoppingCart',
    exact: false,
    app: true,
    tone: 'violet',
    children: [
      { label: 'Dashboard', icon: 'lucideChartColumn', route: '/procurement/dashboard' },
      {
        label: 'Suppliers',
        icon: 'lucideTruck',
        route: '/procurement/suppliers',
        permission: Permissions.suppliersView,
      },
      {
        label: 'Requisitions',
        icon: 'lucideClipboardList',
        route: '/procurement/requisitions',
        permission: Permissions.requisitionsView,
      },
      {
        label: 'RFQs',
        icon: 'lucideGitCompareArrows',
        route: '/procurement/rfqs',
        permission: Permissions.rfqsView,
      },
      {
        label: 'Purchase Orders',
        icon: 'lucideShoppingCart',
        route: '/procurement/orders',
        permission: Permissions.ordersView,
      },
      {
        label: 'Goods Receipts',
        icon: 'lucidePackageCheck',
        route: '/procurement/receipts',
        permission: Permissions.receiptsView,
      },
      {
        label: 'Returns',
        icon: 'lucidePackageX',
        route: '/procurement/returns',
        permission: Permissions.returnsView,
      },
      {
        label: 'Purchase Invoices',
        icon: 'lucideReceiptText',
        route: '/procurement/invoices',
        permission: Permissions.purchaseInvoicesView,
      },
      {
        label: 'GRNI',
        icon: 'lucidePackageCheck',
        route: '/procurement/grni',
        permission: Permissions.procurementReportsView,
      },
      {
        label: 'Supplier Payments',
        icon: 'lucideBanknote',
        route: '/procurement/payments',
        permission: Permissions.paymentsView,
      },
      {
        label: 'Auto-reorder',
        icon: 'lucideRefreshCw',
        route: '/procurement/reorder',
        permission: Permissions.ordersCreate,
      },
      {
        label: 'Reports',
        icon: 'lucideChartColumn',
        route: '/procurement/reports',
        permission: Permissions.procurementReportsView,
      },
    ],
  },
  {
    label: 'Sales',
    icon: 'lucideTrendingUp',
    exact: false,
    app: true,
    tone: 'emerald',
    children: [
      { label: 'Dashboard', icon: 'lucideChartColumn', route: '/sales/dashboard' },
      {
        label: 'Customers',
        icon: 'lucideUsers',
        route: '/sales/customers',
        permission: Permissions.customersView,
      },
      {
        label: 'Price Lists',
        icon: 'lucidePercent',
        route: '/sales/price-lists',
        permission: Permissions.pricingView,
      },
      {
        label: 'Quotations',
        icon: 'lucideFileText',
        route: '/sales/quotations',
        permission: Permissions.quotationsView,
      },
      {
        label: 'Sales Orders',
        icon: 'lucideClipboardList',
        route: '/sales/orders',
        permission: Permissions.salesOrdersView,
      },
      {
        label: 'Deliveries',
        icon: 'lucideTruck',
        route: '/sales/deliveries',
        permission: Permissions.deliveriesView,
      },
      {
        label: 'Sales Invoices',
        icon: 'lucideReceiptText',
        route: '/sales/invoices',
        permission: Permissions.salesInvoicesView,
      },
      {
        label: 'Credit Notes',
        icon: 'lucideUndo2',
        route: '/sales/credit-notes',
        permission: Permissions.creditNotesView,
      },
      {
        label: 'Customer Payments',
        icon: 'lucideBanknote',
        route: '/sales/payments',
        permission: Permissions.salesPaymentsView,
      },
      {
        label: 'Reports',
        icon: 'lucideChartColumn',
        route: '/sales/reports',
        permission: Permissions.salesReportsView,
      },
    ],
  },
  {
    label: 'Workspace',
    icon: 'lucideLayoutGrid',
    exact: false,
    children: [
      { label: 'Reports', icon: 'lucideFileText', route: '/workspace/reports' },
    ],
  },
];

/**
 * The administrative areas. Not rendered as a sidebar section — they appear as
 * cards on the administration hub page and as quick-nav search results.
 */
export const ADMIN_PAGES: NavItem[] = [
  {
    label: 'Users',
    icon: 'lucideUsers',
    route: '/administration/users',
    permission: Permissions.usersView,
  },
  {
    label: 'Roles & Permissions',
    icon: 'lucideKeyRound',
    route: '/administration/roles',
    permission: Permissions.rolesView,
  },
  {
    label: 'Audit Logs',
    icon: 'lucideScrollText',
    route: '/administration/audit-logs',
    permission: Permissions.auditLogsView,
  },
  {
    label: 'Business Information',
    icon: 'lucideSlidersHorizontal',
    route: '/administration/settings',
    permission: Permissions.tenantSettings,
  },
];

/**
 * The pinned Administration entry — rendered at the bottom of the sidebar as a
 * plain link (no dropdown). It opens the administration hub page, whose cards
 * carry the admin areas. Shown when the user holds any administrative permission.
 */
export const ADMIN_NAV_ITEM: NavItem = {
  label: 'Administration',
  icon: 'lucideShield',
  route: '/administration',
  exact: false,
  permission: [
    ...new Set(
      ADMIN_PAGES.flatMap((p) =>
        p.permission ? (Array.isArray(p.permission) ? p.permission : [p.permission]) : [],
      ),
    ),
  ],
};

/**
 * The apps launcher, pinned at the top of the sidebar beside Dashboard under
 * app navigation. Changing app is the most common move in that mode, so it is
 * a link, not something inside a section you open first.
 *
 * Classic navigation lists every app already, so it does not appear there.
 */
export const APPS_NAV_ITEM: NavItem = {
  label: 'Apps',
  icon: 'lucideLayoutGrid',
  route: '/workspace/apps',
};

/** The business modules, in the order the sidebar lists them. */
export function apps(items: NavItem[] = NAV_ITEMS): NavItem[] {
  return items.filter((i) => i.app);
}

/** Every route under an item, however deep. */
function routes(item: NavItem): string[] {
  const own = item.route ? [item.route] : [];
  return [...own, ...(item.children ?? []).flatMap(routes)];
}

/**
 * The first path segment an app owns, e.g. `/sales`.
 *
 * Read off its pages rather than declared beside them: the segment is already
 * stated by every route in the section, and a second copy would be one more
 * thing to keep in step.
 */
export function appPrefix(item: NavItem): string | null {
  const first = routes(item)[0];
  const segment = first?.split('/').filter(Boolean)[0];
  return segment ? `/${segment}` : null;
}

/**
 * The app a URL belongs to, if any.
 *
 * This is what stops app navigation from lying: follow a link from a report to
 * a purchase order and the sidebar has to arrive in Procurement, whether or not
 * that is the app you last picked.
 */
export function appForUrl(url: string, items: NavItem[] = NAV_ITEMS): NavItem | null {
  const path = url.split(/[?#]/)[0];
  return (
    apps(items).find((a) => {
      const prefix = appPrefix(a);
      return !!prefix && (path === prefix || path.startsWith(`${prefix}/`));
    }) ?? null
  );
}

/**
 * Filter a nav tree by permission. A leaf survives when its `permission` is
 * granted (or it declares none). A parent survives when its own permission is
 * granted *and* it retains at least one visible child (or has a direct route).
 */
export function filterNav(items: NavItem[], can: (names: string[]) => boolean): NavItem[] {
  const check = (p: NavItem['permission']): boolean =>
    p === undefined ? true : can(Array.isArray(p) ? p : [p]);

  const walk = (item: NavItem): NavItem | null => {
    if (!check(item.permission)) return null;
    if (!item.children?.length) return item;
    const children = item.children.map(walk).filter((c): c is NavItem => c !== null);
    if (children.length === 0 && !item.route) return null;
    return { ...item, children };
  };

  return items.map(walk).filter((i): i is NavItem => i !== null);
}
