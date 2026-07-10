import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

/** Dashed placeholder block used by skeleton pages until real content lands. */
@Component({
  selector: 'app-placeholder-panel',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-xl border
             border-dashed border-border bg-card p-10 text-center"
    >
      <ng-icon [name]="icon()" size="28" class="text-muted-foreground/60" />
      <p class="text-sm font-medium text-foreground">{{ title() }}</p>
      <p class="max-w-md text-sm text-muted-foreground">{{ message() }}</p>
    </div>
  `,
})
export class PlaceholderPanel {
  readonly title = input.required<string>();
  readonly message = input('This area is part of the layout skeleton and is ready for content.');
  readonly icon = input('lucideInbox');
}
