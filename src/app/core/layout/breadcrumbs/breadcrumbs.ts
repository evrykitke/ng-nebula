import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

export interface Crumb {
  label: string;
  route?: string;
}

/** Dumb breadcrumb trail with a home root and chevron separators. */
@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
      <a routerLink="/" class="flex items-center hover:text-foreground">
        <ng-icon name="lucideHouse" size="13" />
      </a>
      @for (c of items(); track c.label; let last = $last) {
        <ng-icon name="lucideChevronRight" size="13" class="opacity-50" />
        @if (c.route && !last) {
          <a [routerLink]="c.route" class="hover:text-foreground">{{ c.label }}</a>
        } @else {
          <span class="font-medium text-foreground">{{ c.label }}</span>
        }
      }
    </nav>
  `,
})
export class Breadcrumbs {
  readonly items = input<Crumb[]>([]);
}
