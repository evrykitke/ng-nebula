import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** Circular avatar with an initials fallback when the image is missing or fails. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'host()' },
  template: `
    @if (image() && !failed()) {
      <img [src]="image()" [alt]="name()" class="h-full w-full object-cover" (error)="failed.set(true)" />
    } @else {
      <span class="text-xs font-semibold">{{ initials() }}</span>
    }
  `,
})
export class Avatar {
  readonly image = input<string | null | undefined>();
  readonly name = input<string>('');
  /** Tailwind size classes (height/width). */
  readonly size = input<string>('h-8 w-8');

  protected readonly failed = signal(false);

  protected readonly host = computed(
    () =>
      `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ` +
      `text-muted-foreground ${this.size()}`,
  );

  protected readonly initials = computed(() =>
    this.name()
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );
}
