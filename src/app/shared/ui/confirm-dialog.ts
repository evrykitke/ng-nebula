import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';
import { ConfirmService } from '../../core/services/confirm.service';

/**
 * Global confirmation dialog host. Renders whatever `ConfirmService` currently
 * has pending. Mounted once (in <app-root>) so any feature can call
 * `confirm.ask(...)` without wiring up its own modal.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideIcons({ lucideTriangleAlert })],
  template: `
    @if (confirm.current(); as c) {
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
        (click)="confirm.cancel()"
      >
        <div
          class="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg"
          role="alertdialog"
          aria-modal="true"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-start gap-3">
            @if (c.tone === 'danger') {
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
              >
                <ng-icon name="lucideTriangleAlert" size="18" />
              </span>
            }
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold text-foreground">{{ c.title }}</h3>
              @if (c.message) {
                <p class="mt-1 text-sm text-muted-foreground">{{ c.message }}</p>
              }
            </div>
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              class="h-9 rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
              (click)="confirm.cancel()"
            >
              {{ c.cancelText ?? 'Cancel' }}
            </button>
            <button
              type="button"
              class="h-9 rounded-md px-4 text-sm font-medium"
              [class]="
                c.tone === 'danger'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              "
              (click)="confirm.confirm()"
            >
              {{ c.confirmText ?? 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialog {
  readonly confirm = inject(ConfirmService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirm.current()) this.confirm.cancel();
  }
}
