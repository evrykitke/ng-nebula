import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/**
 * The product brand block: logo mark + wordmark. The mark loads
 * `public/logo.svg` (served from the site root) so dropping a real logo
 * file in makes it appear everywhere; until one exists it falls back to
 * a primary-tinted lettermark tile.
 */
@Component({
  selector: 'app-brand',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2.5">
      @if (!imageFailed()) {
        <img
          src="logo.svg"
          alt="Pylon logo"
          class="h-9 w-9 rounded-lg object-contain"
          (error)="imageFailed.set(true)"
        />
      } @else {
        <div
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-base font-bold
                 text-primary-foreground"
          aria-hidden="true"
        >
          P
        </div>
      }
      @if (showName()) {
        <span class="text-lg font-semibold text-foreground">Pylon</span>
      }
    </div>
  `,
})
export class Brand {
  readonly showName = input(true);
  readonly imageFailed = signal(false);
}
