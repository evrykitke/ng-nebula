import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { NgIcon } from '@ng-icons/core';
import { UiTooltip } from '../../../shared/ui/tooltip';
import { Avatar } from '../../../shared/ui/avatar';
import { LayoutService, NavMode } from '../layout.service';
import { appForUrl } from '../nav.model';
import { ThemeService } from '../../theme/theme.service';
import { AuthService } from '../../auth/auth.service';
import { ThemeModal } from '../../theme/theme-modal';

/** Fixed header bar: sidebar toggle, page title, theme toggle, user menu. */
@Component({
  selector: 'app-topbar',
  imports: [RouterLink, CdkMenu, CdkMenuItem, CdkMenuTrigger, NgIcon, UiTooltip, Avatar, ThemeModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <header
      class="flex h-14 items-center gap-3 border-b border-border bg-card px-4"
    >
      <!-- Sidebar collapse toggle -->
      <button
        type="button"
        (click)="layout.toggleSidebar()"
        uiTooltip="Toggle sidebar"
        tooltipPosition="bottom"
        class="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground
               transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label="Toggle sidebar"
      >
        <ng-icon name="lucidePanelLeft" size="20" />
      </button>

      <span class="min-w-0 truncate text-sm font-semibold text-foreground">{{ pageTitle() }}</span>

      <!-- Theme + appearance dropdown -->
      <button
        type="button"
        (click)="themeModalOpen.set(true)"
        uiTooltip="Theme & appearance"
        tooltipPosition="bottom"
        class="ml-auto flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2.5
               text-sm text-foreground transition-colors hover:bg-accent"
        aria-label="Theme and appearance"
      >
        <span class="h-3.5 w-3.5 rounded-full" [style.background-color]="activeColor()"></span>
        <ng-icon [name]="themeService.isDark() ? 'lucideMoon' : 'lucideSun'" size="15" class="text-muted-foreground" />
      </button>

      <app-theme-modal [open]="themeModalOpen()" (closed)="themeModalOpen.set(false)" />

      <!-- User menu -->
      <button
        type="button"
        [cdkMenuTriggerFor]="userMenu"
        class="flex items-center gap-2 rounded-md p-0.5 pr-1.5 hover:bg-accent"
        aria-label="User menu"
      >
        <app-avatar [image]="user()?.avatar_url" [name]="user()?.display_name ?? ''" />
        <span class="hidden text-sm font-medium text-foreground lg:block">{{
          user()?.display_name
        }}</span>
        <ng-icon name="lucideChevronDown" size="14" class="hidden text-muted-foreground lg:block" />
      </button>

      <ng-template #userMenu>
        <div
          cdkMenu
          class="mt-1 min-w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <div class="px-2 py-1.5">
            <p class="text-sm font-medium">{{ user()?.display_name }}</p>
            <p class="truncate text-xs text-muted-foreground">{{ user()?.email }}</p>
          </div>
          <div class="my-1 h-px bg-border"></div>
          <button cdkMenuItem routerLink="/profile" class="menu-item">
            <ng-icon name="lucideUser" size="16" /> Profile
          </button>

          <!-- How the sidebar presents the product. Here rather than in
               settings because it is a preference you try, dislike and undo. -->
          <div class="my-1 h-px bg-border"></div>
          <p class="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Navigation
          </p>
          <button cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="setNav('classic')">
            <ng-icon name="lucideList" size="16" /> Classic
            @if (layout.navMode() === 'classic') {
              <ng-icon name="lucideCheck" size="14" class="ml-auto text-primary" />
            }
          </button>
          <button cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="setNav('app')">
            <ng-icon name="lucideLayoutGrid" size="16" /> Apps
            @if (layout.navMode() === 'app') {
              <ng-icon name="lucideCheck" size="14" class="ml-auto text-primary" />
            }
          </button>

          <div class="my-1 h-px bg-border"></div>
          <button cdkMenuItem (cdkMenuItemTriggered)="signOut()" class="menu-item">
            <ng-icon name="lucideLogOut" size="16" /> Sign out
          </button>
        </div>
      </ng-template>
    </header>
  `,
  styles: [
    `
      .menu-item {
        display: flex;
        width: 100%;
        align-items: center;
        gap: 0.5rem;
        border-radius: calc(var(--radius) * 0.6);
        padding: 0.375rem 0.5rem;
        font-size: 0.8125rem;
        color: var(--popover-foreground);
        cursor: pointer;
      }
      .menu-item:hover,
      .menu-item:focus-visible {
        background: var(--accent);
        outline: none;
      }
    `,
  ],
})
export class Topbar {
  readonly layout = inject(LayoutService);
  readonly themeService = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;

  /** Page title derived reactively from router navigation (RxJS). */
  readonly pageTitle = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => this.titleFromUrl(e.urlAfterRedirects)),
      startWith(this.titleFromUrl(this.router.url)),
    ),
    { initialValue: '' },
  );

  /** Swatch color of the currently active theme (for the trigger button). */
  readonly activeColor = computed(
    () => this.themeService.themes.find((t) => t.id === this.themeService.theme())?.color ?? '#000',
  );

  /** The appearance dialog (theme + mode). */
  readonly themeModalOpen = signal(false);

  signOut(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  /**
   * Switch how the sidebar presents the product. Turning app navigation on from
   * a page that belongs to no app leaves the sidebar with only home, so the
   * launcher is the honest place to land.
   */
  setNav(mode: NavMode): void {
    this.layout.setNavMode(mode);
    if (mode === 'app' && !appForUrl(this.router.url)) {
      void this.router.navigateByUrl('/workspace/apps');
    }
  }

  private titleFromUrl(url: string): string {
    const seg = url.split('?')[0].split('/').filter(Boolean)[0] ?? 'dashboard';
    return seg.charAt(0).toUpperCase() + seg.slice(1);
  }
}
