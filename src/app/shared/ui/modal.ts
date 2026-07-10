import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  booleanAttribute,
  computed,
  input,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';

export type ModalSize = 'sm' | 'md' | 'lg';

/** Tailwind max-width per size — from `sm` up only, so the mobile bottom sheet
 * always spans the full viewport width. */
const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-3xl',
};

/**
 * Reusable themed dialog. Renders a centred card over a dimmed backdrop, honours
 * the active theme tokens (`bg-card` / `border-border`), and supports `sm`/`md`/`lg`
 * sizes. Structure it with the projected slots:
 *
 *   <app-modal [open]="show()" size="md" title="Edit" (closed)="show.set(false)">
 *     …body…
 *     <div modalFooter> …buttons… </div>
 *   </app-modal>
 *
 * The body scrolls when content exceeds the viewport so large modals stay usable.
 * Set `dismissible="false"` to require an explicit action (backdrop/Esc/× disabled).
 * For a native form, wrap your fields + buttons in a `<form>` placed in the body
 * and omit the footer slot (or keep the footer inside the same form).
 */
@Component({
  selector: 'app-modal',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideIcons({ lucideX })],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
        (click)="onBackdrop()"
      >
        <div
          [class]="cardClass()"
          role="dialog"
          aria-modal="true"
          (click)="$event.stopPropagation()"
        >
          @if (title() || dismissible()) {
            <div class="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
              <div class="min-w-0">
                @if (title()) {
                  <h2 class="text-base font-semibold text-foreground">{{ title() }}</h2>
                }
                @if (subtitle()) {
                  <p class="mt-0.5 text-sm text-muted-foreground">{{ subtitle() }}</p>
                }
              </div>
              @if (dismissible()) {
                <button
                  type="button"
                  class="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Close"
                  (click)="close()"
                >
                  <ng-icon name="lucideX" size="18" />
                </button>
              }
            </div>
          }

          <div class="max-h-[70vh] overflow-y-auto px-6 py-5">
            <ng-content />
          </div>

          <ng-content select="[modalFooter]" />
        </div>
      </div>
    }
  `,
})
export class Modal {
  /** Whether the modal is shown. Drive from a signal in the parent. */
  readonly open = input.required<boolean>();
  readonly size = input<ModalSize>('md');
  readonly title = input<string>();
  readonly subtitle = input<string>();
  /** When false, backdrop click, Esc, and the × button are disabled. */
  readonly dismissible = input(true, { transform: booleanAttribute });

  /** Emitted when the user dismisses (backdrop / Esc / ×). */
  readonly closed = output<void>();

  /* Below `sm` the dialog docks to the bottom edge as a full-width sheet
     (easier one-handed reach, no cramped side gutters); from `sm` up it is the
     familiar centred card. */
  protected readonly cardClass = computed(
    () =>
      `flex w-full ${SIZE_CLASS[this.size()]} max-h-[92vh] flex-col overflow-hidden ` +
      'rounded-t-xl rounded-b-none sm:rounded-xl border border-border bg-card shadow-lg modal-in',
  );

  protected onBackdrop(): void {
    if (this.dismissible()) this.close();
  }

  close(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open() && this.dismissible()) this.close();
  }
}
