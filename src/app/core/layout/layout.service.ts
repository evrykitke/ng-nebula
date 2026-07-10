import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** Viewport widths below this (px) use the off-canvas drawer (Tailwind `lg`). */
const MOBILE_QUERY = '(max-width: 1023px)';

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

  readonly collapsed = this._collapsed.asReadonly();
  readonly mobileOpen = this._mobileOpen.asReadonly();
  readonly isMobile = this._isMobile.asReadonly();

  private readonly router = inject(Router);

  constructor() {
    // Any navigation dismisses the mobile drawer (covers link clicks, the user
    // menu, programmatic routing) without threading an event through the menu.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this._mobileOpen.set(false));

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
}
