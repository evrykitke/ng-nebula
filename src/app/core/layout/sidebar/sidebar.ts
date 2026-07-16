import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { QuickNav } from './quick-nav';
import { SidebarMenuItem } from './sidebar-menu-item';
import { SidebarMenuService } from './sidebar-menu.service';
import { LayoutService, SIDEBAR_RAIL, SIDEBAR_WIDTH } from '../layout.service';
import {
  ADMIN_NAV_ITEM,
  APPS_NAV_ITEM,
  NAV_ITEMS,
  NavItem,
  appPages,
  filterNav,
} from '../nav.model';
import { AuthService } from '../../auth/auth.service';

/**
 * Navigation sidebar. On desktop it is a persistent rail that collapses between
 * 240px (expanded) and 56px (icon-only). On mobile it becomes a fixed off-canvas
 * drawer that slides in over the content; both states are driven by
 * LayoutService so the topbar's single toggle button controls the right one.
 */
@Component({
  selector: 'app-sidebar',
  imports: [QuickNav, SidebarMenuItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SidebarMenuService],
  host: { class: 'contents' },
  template: `
    <aside
      class="flex h-full shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar
             text-sidebar-foreground"
      [class.fixed]="isMobile()"
      [class.inset-y-0]="isMobile()"
      [class.left-0]="isMobile()"
      [class.z-50]="isMobile()"
      [class.w-60]="isMobile()"
      [class.shadow-xl]="isMobile()"
      [class.transition-transform]="isMobile()"
      [class.duration-200]="true"
      [class.ease-in-out]="true"
      [class.-translate-x-full]="isMobile() && !mobileOpen()"
      [class.transition-[width]]="!isMobile()"
      [style.width.px]="isMobile() ? null : iconOnly() ? rail : width"
    >
      <!-- Brand -->
      <div class="flex h-14 shrink-0 items-center px-4">
        @if (!iconOnly()) {
          <span class="truncate text-base font-semibold text-sidebar-accent-foreground">Pylon</span>
        }
      </div>

      <!-- Quick navigation (Ctrl+K) -->
      <div class="shrink-0 px-2.5 pb-1">
        <app-quick-nav />
      </div>

      <!-- Navigation -->
      <nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-2.5 py-3">
        @for (item of navItems(); track item.label) {
          <app-sidebar-menu-item [item]="item" [collapsed]="iconOnly()" />
        }
      </nav>

      <!-- Pinned: Administration hub (plain link, no dropdown) -->
      @if (adminItem(); as admin) {
        <div class="shrink-0 border-t border-sidebar-border px-2.5 py-2">
          <app-sidebar-menu-item [item]="admin" [collapsed]="iconOnly()" />
        </div>
      }

      <!-- Footer -->
      @if (!iconOnly()) {
        <div class="shrink-0 border-t border-sidebar-border px-4 py-3 text-xs">
          <span class="text-sidebar-foreground">v0.1.0</span>
        </div>
      }
    </aside>
  `,
})
export class Sidebar {
  private readonly layout = inject(LayoutService);
  private readonly auth = inject(AuthService);

  /** Nav filtered to the items the current user is permitted to see. */
  private readonly permitted = computed(() =>
    filterNav(NAV_ITEMS, (names) => this.auth.hasAnyPermission(names)),
  );

  /**
   * What the sidebar shows.
   *
   * Classic is every app at once. App navigation is the launcher and the one
   * app in hand — nothing else. Two entries at rest, where there were thirty.
   *
   * The workspace's own pages, Dashboard among them, ride inside the Workspace
   * app: cross-cutting work is still somewhere you go, and pinning any of it
   * beside the launcher would start the same creep again.
   */
  readonly navItems = computed<NavItem[]>(() => {
    const items = this.permitted();
    if (this.layout.navMode() === 'classic') return items;

    // The app opens itself: the menu item expands the branch its active route
    // is in, and in app mode you are always in the app being shown.
    const active = items.find((i) => i.app && i.label === this.layout.activeApp());
    return [APPS_NAV_ITEM, ...(active ? [{ ...active, children: appPages(active, items) }] : [])];
  });


  /** The pinned Administration link, or null when the user holds no admin permission. */
  readonly adminItem = computed(
    () => filterNav([ADMIN_NAV_ITEM], (names) => this.auth.hasAnyPermission(names))[0] ?? null,
  );

  readonly isMobile = this.layout.isMobile;
  readonly mobileOpen = this.layout.mobileOpen;

  /** Icon-only strip: the desktop collapsed rail (never on the mobile drawer). */
  readonly iconOnly = computed(() => !this.isMobile() && this.layout.collapsed());

  /** Shared so anything laying out beside the rail measures the same edge. */
  readonly width = SIDEBAR_WIDTH;
  readonly rail = SIDEBAR_RAIL;
}
