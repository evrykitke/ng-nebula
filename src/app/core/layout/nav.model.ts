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
}

/**
 * Primary application navigation. Items are filtered by permission at render.
 * Business areas (the ERP modules) mount here as they are built.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'lucideLayoutDashboard', route: '/dashboard' },
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
    label: 'Tenant Settings',
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
