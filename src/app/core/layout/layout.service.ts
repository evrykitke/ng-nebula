import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { appForUrl } from './nav.model';

/** Viewport widths below this (px) use the off-canvas drawer (Tailwind `lg`). */
const MOBILE_QUERY = '(max-width: 1023px)';

/**
 * How the sidebar presents the product.
 *
 * `classic` lists every app at once — fine while there are three, and a wall by
 * the time there are eight. `app` shows home and the app in hand, and the rest
 * live behind the launcher.
 */
export type NavMode = 'classic' | 'app';

const MODE_KEY = 'pylon.nav-mode';
const APP_KEY = 'pylon.nav-app';

/** localStorage, but never a reason to fail. */
function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // A preference that cannot be remembered is not worth an error.
  }
}

/**
 * The desktop sidebar's width, expanded and collapsed to its icon rail.
 *
 * Here rather than in the sidebar because anything that lays itself out beside
 * the sidebar needs the same number — a full-height panel has to know where the
 * nav ends, and a second copy of `240` is a second copy to keep in step.
 */
export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_RAIL = 56;

/**
 * Shared layout UI state. Two distinct sidebar modes live here because both the
 * topbar's toggle button and the sidebar need them:
 *  - desktop (`lg`+): a persistent rail that collapses to an icon-only strip;
 *  - mobile: an off-canvas drawer that slides over the content with a backdrop.
 *
 * The active viewport is tracked via `matchMedia` so the single toggle button
 * drives the right behaviour, and switching to desktop always closes the drawer.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  /** Desktop icon-only rail. */
  private readonly _collapsed = signal(false);
  /** Mobile drawer visibility. */
  private readonly _mobileOpen = signal(false);
  /** Viewport is below the `lg` breakpoint (drawer mode). */
  private readonly _isMobile = signal(false);

  /** How the sidebar presents the product. */
  private readonly _navMode = signal<NavMode>(stored(MODE_KEY) === 'app' ? 'app' : 'classic');
  /** The app whose menu the sidebar is showing, under app navigation. */
  private readonly _activeApp = signal<string | null>(stored(APP_KEY));

  readonly collapsed = this._collapsed.asReadonly();
  readonly mobileOpen = this._mobileOpen.asReadonly();
  readonly isMobile = this._isMobile.asReadonly();
  readonly navMode = this._navMode.asReadonly();
  readonly activeApp = this._activeApp.asReadonly();

  private readonly router = inject(Router);

  constructor() {
    // Any navigation dismisses the mobile drawer (covers link clicks, the user
    // menu, programmatic routing) without threading an event through the menu.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this._mobileOpen.set(false);
        // Follow the URL into whichever app it belongs to. Without this the
        // sidebar would show the app you last picked while you stood in
        // another — every cross-app link (a report to an order, a search
        // result) would strand you.
        const app = appForUrl(e.urlAfterRedirects);
        if (app) this.setActiveApp(app.label);
      });

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia(MOBILE_QUERY);
      const apply = (matches: boolean): void => {
        this._isMobile.set(matches);
        // Leaving mobile discards the transient drawer state.
        if (!matches) this._mobileOpen.set(false);
      };
      apply(mq.matches);
      mq.addEventListener('change', (e) => apply(e.matches));
    }
  }

  /** Context-aware toggle for the topbar button. */
  toggleSidebar(): void {
    if (this._isMobile()) this._mobileOpen.update((v) => !v);
    else this._collapsed.update((v) => !v);
  }

  /** Dismiss the mobile drawer (backdrop click, navigation, Escape). */
  closeMobile(): void {
    this._mobileOpen.set(false);
  }

  setCollapsed(collapsed: boolean): void {
    this._collapsed.set(collapsed);
  }

  setNavMode(mode: NavMode): void {
    this._navMode.set(mode);
    store(MODE_KEY, mode);
  }

  /** Show this app's menu in the sidebar. `null` shows just home. */
  setActiveApp(label: string | null): void {
    this._activeApp.set(label);
    store(APP_KEY, label);
  }
}
