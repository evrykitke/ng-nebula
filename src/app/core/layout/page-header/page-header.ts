import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Breadcrumbs, Crumb } from '../breadcrumbs/breadcrumbs';

/**
 * Reusable feature page header: breadcrumb trail, title, optional subtitle, and
 * a projected actions slot — mark content with the `actions` attribute
 * (e.g. `<button actions uiBtn>`). No template ref needed.
 */
@Component({
  selector: 'app-page-header',
  imports: [Breadcrumbs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-start justify-between gap-4">
      <div class="min-w-0">
        @if (breadcrumbs().length) {
          <app-breadcrumbs [items]="breadcrumbs()" />
        }
        <h1 class="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="mt-1 text-sm text-muted-foreground">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <ng-content select="[actions]" />
      </div>
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly breadcrumbs = input<Crumb[]>([]);
}
