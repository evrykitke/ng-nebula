import { Permissions } from '../auth/permissions.constants';
import { APPS } from './apps';

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
   * This section is an app — a body of work with a life of its own.
   *
   * Classic navigation lists every app at once. App navigation shows one at a
   * time, so the sidebar carries the pages of the work in hand rather than
   * every page in the product. Workspace is one too: what is cross-cutting to
   * the business is still somewhere you go, not a frame around everywhere else.
   */
  app?: boolean;
  /**
   * An app's colour in the launcher. Apps are told apart at a glance by colour
   * before the label is read, so each owns one — but only in the launcher: a
   * sidebar full of colours is a sidebar you have to read anyway.
   */
  tone?: AppTone;
  /**
   * What an app is for, in a line. Shown on its launcher card.
   *
   * A name is not a description: "Procurement" tells someone who already knows
   * what it holds, and nobody else. This says what the work is, so the launcher
   * can be read by someone on their first day.
   */
  description?: string;
  /**
   * The app that adopts the top-level pages belonging to no app — the
   * dashboard.
   *
   * Classic navigation pins those at the top of the sidebar; app navigation has
   * no top to pin them to, and they are not nothing. Home takes them in.
   */
  home?: boolean;
}

/** The launcher's palette. One per app, and each app keeps its own. */
export type AppTone = 'indigo' | 'amber' | 'violet' | 'emerald' | 'sky' | 'rose';

/**
 * Primary navigation: home's own page, then the apps.
 *
 * Composed, not declared. Each app states its own menu beside its own pages
 * (see `app.model`), so adding one is a file rather than an edit here, an edit
 * in the routes, and a hope that the two agree.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'lucideLayoutDashboard', route: '/dashboard' },
  ...APPS.map((a) => a.nav),
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
 * The apps launcher, pinned at the top of the sidebar under app navigation.
 * Changing app is the most common move in that mode, so it is a link, not
 * something inside a section you open first.
 *
 * At `/apps`, deliberately outside every app's prefix: under `/workspace` it
 * belonged to the Workspace app, so opening the launcher from Sales quietly
 * moved you into Workspace — and going back left you somewhere you never chose.
 *
 * Classic navigation lists every app already, so it does not appear there.
 */
export const APPS_NAV_ITEM: NavItem = {
  label: 'Apps',
  icon: 'lucideLayoutGrid',
  route: '/apps',
};

/** The business modules, in the order the sidebar lists them. */
export function apps(items: NavItem[] = NAV_ITEMS): NavItem[] {
  return items.filter((i) => i.app);
}

/**
 * An app's pages under app navigation — its own, plus the loose top-level ones
 * that home adopts.
 *
 * One definition, because two would drift: the sidebar showed the dashboard
 * under Workspace while the launcher counted its pages without it, and the card
 * said "1 page" over a menu of two.
 */
export function appPages(app: NavItem, items: NavItem[] = NAV_ITEMS): NavItem[] {
  const adopted = app.home ? items.filter((i) => !i.app && !i.children?.length) : [];
  return [...adopted, ...(app.children ?? [])];
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
