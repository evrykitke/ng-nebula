import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { PageHeader } from '../../core/layout/page-header/page-header';
import { ADMIN_PAGES, filterNav } from '../../core/layout/nav.model';
import { AuthService } from '../../core/auth/auth.service';

/** The administration hub: one card per admin area the user may enter. */
@Component({
  selector: 'app-administration-hub-page',
  imports: [RouterLink, NgIcon, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Administration"
      subtitle="Manage your workspace — people, access and the audit trail"
      [breadcrumbs]="[{ label: 'Administration' }]"
    />
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      @for (page of pages(); track page.route) {
        <a
          [routerLink]="page.route"
          class="group flex items-start gap-3 rounded-xl border border-border bg-card p-4
                 transition-all hover:border-primary/40 hover:shadow-md"
        >
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10
                   text-primary"
          >
            <ng-icon [name]="page.icon!" size="20" />
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-semibold text-foreground group-hover:text-primary">
              {{ page.label }}
            </span>
            <span class="mt-0.5 block text-xs text-muted-foreground">Open {{ page.label }}</span>
          </span>
        </a>
      }
    </div>
  `,
})
export class AdministrationHubPage {
  private readonly auth = inject(AuthService);

  readonly pages = computed(() =>
    filterNav(ADMIN_PAGES, (names) => this.auth.hasAnyPermission(names)),
  );
}
