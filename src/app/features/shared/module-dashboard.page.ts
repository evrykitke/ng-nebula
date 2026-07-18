import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSettings2 } from '@ng-icons/lucide';
import { PageHeader } from '../../core/layout/page-header/page-header';
import { UiButton } from '../../shared/ui/button';
import { NAV_ITEMS, appForUrl, appPrefix } from '../../core/layout/nav.model';
import { DashboardCanvas } from './dashboard/dashboard-canvas';

/**
 * A module's dashboard landing page, shared by every app.
 *
 * The backend names each canvas after the app's URL prefix ("accounting",
 * "inventory", "procurement", "sales", "pos"), so one page serves them
 * all: it reads which app it woke up in off the URL and mounts that
 * canvas. The header's Customize button is the way into the widget
 * catalogue, as everywhere else.
 */
@Component({
  selector: 'app-module-dashboard-page',
  imports: [NgIcon, PageHeader, UiButton, DashboardCanvas],
  providers: [provideIcons({ lucideSettings2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './module-dashboard.page.html',
})
export class ModuleDashboardPage {
  private readonly router = inject(Router);

  /** Which app this is a dashboard for, read off the URL. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly app = computed(() => appForUrl(this.url(), NAV_ITEMS));

  /** The backend canvas name — the app's URL prefix without its slash. */
  readonly canvasName = computed(() => {
    const app = this.app();
    const prefix = app ? appPrefix(app) : null;
    return prefix?.replace('/', '') ?? 'workspace';
  });
}
