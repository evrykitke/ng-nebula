import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBoxes,
  lucideCalculator,
  lucideLayoutGrid,
  lucideShoppingCart,
  lucideTrendingUp,
} from '@ng-icons/lucide';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeader } from '../../core/layout/page-header/page-header';
import { LayoutService } from '../../core/layout/layout.service';
import { AppTone, NAV_ITEMS, NavItem, appPages, apps, filterNav } from '../../core/layout/nav.model';

/**
 * The launcher's palette: a muted wash behind a saturated glyph, dark mode
 * included. Restrained on purpose — these sit beside each other, and six loud
 * tiles read as a toy rather than a tool.
 */
const TONES: Record<AppTone, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400',
};

/**
 * The apps launcher: every module the user can open.
 *
 * The home of app navigation. Picking an app puts its menu in the sidebar and
 * opens its first page, so the sidebar carries the work in hand rather than the
 * whole product. Under classic navigation this page still works — it is simply
 * a longer way to a menu that is already on screen.
 */
@Component({
  selector: 'app-apps-page',
  imports: [NgIcon, PageHeader],
  providers: [
    provideIcons({
      lucideLayoutGrid,
      lucideCalculator,
      lucideBoxes,
      lucideShoppingCart,
      lucideTrendingUp,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Apps"
      subtitle="Everything this workspace runs"
      [breadcrumbs]="[{ label: 'Apps' }]"
    />

    @if (available().length === 0) {
      <div
        class="flex flex-col items-center justify-center rounded-lg border border-dashed border-border
               py-16 text-center text-muted-foreground"
      >
        <ng-icon name="lucideLayoutGrid" size="40" />
        <p class="mt-3 text-sm">No apps are available to you yet.</p>
      </div>
    } @else {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (app of available(); track app.label) {
          <button
            type="button"
            class="group flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-6
                   text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            [class.border-primary]="app.label === active()"
            (click)="open(app)"
          >
            <span class="flex w-full items-start justify-between gap-3">
              <span
                class="flex size-14 shrink-0 items-center justify-center rounded-md transition group-hover:scale-105"
                [class]="toneClass(app)"
              >
                <ng-icon [name]="app.icon ?? 'lucideLayoutGrid'" size="28" />
              </span>
              @if (app.label === active()) {
                <span class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Open
                </span>
              }
            </span>
            <span class="min-w-0">
              <span class="block text-base font-semibold text-foreground">{{ app.label }}</span>
              <span class="mt-1 block text-sm leading-relaxed text-muted-foreground">
                {{ app.description ?? summary(app) }}
              </span>
              <span class="mt-2.5 block text-xs text-muted-foreground/80">{{ pageCount(app) }}</span>
            </span>
          </button>
        }
      </div>
    }
  `,
})
export class AppsPage {
  private readonly auth = inject(AuthService);
  private readonly layout = inject(LayoutService);
  private readonly router = inject(Router);

  readonly active = this.layout.activeApp;

  private readonly permitted = computed(() =>
    filterNav(NAV_ITEMS, (names) => this.auth.hasAnyPermission(names)),
  );

  /** The apps this user may open — an app with no permitted page is not one. */
  readonly available = computed(() => apps(this.permitted()));

  /**
   * An app's colour. Written out rather than built from `bg-${tone}-500/10`,
   * because Tailwind reads the source for class names and never sees a string
   * assembled at runtime — the shade would simply not be in the stylesheet.
   */
  toneClass(app: NavItem): string {
    return TONES[app.tone ?? 'sky'];
  }

  /** How much is in there — a card should hint at an app's size, not just its job. */
  pageCount(app: NavItem): string {
    const n = appPages(app, this.permitted()).filter((c) => c.route).length;
    return n === 1 ? '1 page' : `${n} pages`;
  }

  /** Fallback for an app with no description of its own: what it holds. */
  summary(app: NavItem): string {
    const pages = (app.children ?? []).map((c) => c.label);
    const shown = pages.slice(0, 3).join(' · ');
    return pages.length > 3 ? `${shown} · +${pages.length - 3} more` : shown;
  }

  open(app: NavItem): void {
    this.layout.setActiveApp(app.label);
    const first = appPages(app, this.permitted()).find((c) => c.route)?.route;
    if (first) void this.router.navigateByUrl(first);
  }
}
