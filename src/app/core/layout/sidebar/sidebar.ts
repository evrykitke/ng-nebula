import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { QuickNav } from './quick-nav';
import { SidebarMenuItem } from './sidebar-menu-item';
import { SidebarMenuService } from './sidebar-menu.service';
import { LayoutService } from '../layout.service';
import { ADMIN_NAV_ITEM, NAV_ITEMS, filterNav } from '../nav.model';
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
      [style.width.px]="isMobile() ? null : iconOnly() ? 56 : 240"
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
  readonly navItems = computed(() =>
    filterNav(NAV_ITEMS, (names) => this.auth.hasAnyPermission(names)),
  );

  /** The pinned Administration link, or null when the user holds no admin permission. */
  readonly adminItem = computed(
    () => filterNav([ADMIN_NAV_ITEM], (names) => this.auth.hasAnyPermission(names))[0] ?? null,
  );

  readonly isMobile = this.layout.isMobile;
  readonly mobileOpen = this.layout.mobileOpen;

  /** Icon-only strip: the desktop collapsed rail (never on the mobile drawer). */
  readonly iconOnly = computed(() => !this.isMobile() && this.layout.collapsed());
}
