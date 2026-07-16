import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChartColumn } from '@ng-icons/lucide';
import { PageHeader } from '../../core/layout/page-header/page-header';
import { NAV_ITEMS, NavItem, appForUrl } from '../../core/layout/nav.model';

/**
 * A module's dashboard, before it has one.
 *
 * Each app is getting its own landing page — the numbers that matter to that
 * app, on arrival. The link is in the sidebar now, so the page has to exist:
 * a menu entry that 404s is worse than one that says "not yet". Until each is
 * built, this stands in and offers the app's pages, so landing here is still a
 * way in rather than a dead end.
 */
@Component({
  selector: 'app-module-dashboard-page',
  imports: [RouterLink, NgIcon, PageHeader],
  providers: [provideIcons({ lucideChartColumn })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      [title]="(app()?.label ?? 'Module') + ' dashboard'"
      subtitle="Coming soon"
      [breadcrumbs]="[{ label: app()?.label ?? 'Module' }, { label: 'Dashboard' }]"
    />

    <div
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border
             py-14 text-center"
    >
      <ng-icon name="lucideChartColumn" size="36" class="text-muted-foreground" />
      <p class="mt-3 text-sm font-medium text-foreground">
        {{ app()?.label }} has no dashboard yet
      </p>
      <p class="mt-1 max-w-md text-sm text-muted-foreground">
        This is where {{ app()?.label ?? 'the module' }}'s figures will land. Until then, its pages
        are below.
      </p>

      @if (pages().length) {
        <div class="mt-5 flex flex-wrap justify-center gap-2 px-6">
          @for (page of pages(); track page.label) {
            <a
              [routerLink]="page.route"
              class="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground
                     transition hover:bg-accent hover:text-foreground"
            >
              {{ page.label }}
            </a>
          }
        </div>
      }
    </div>
  `,
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

  /** The app's real pages — this one is a placeholder, so it excludes itself. */
  readonly pages = computed<NavItem[]>(() =>
    (this.app()?.children ?? []).filter((c) => c.route && !c.route.endsWith('/dashboard')),
  );
}
