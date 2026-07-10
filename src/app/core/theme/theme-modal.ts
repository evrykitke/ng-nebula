import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideMonitor, lucideMoon, lucideSun } from '@ng-icons/lucide';
import { Modal } from '../../shared/ui/modal';
import { ThemeService } from './theme.service';
import { AppTheme, ThemeMode } from './theme.model';

/**
 * The appearance dialog: light/dark/system mode plus a card per theme with a
 * live miniature preview. Each preview re-scopes the CSS variables by setting
 * `data-theme` (and `.dark`) on its own subtree, so it renders the real
 * palette, radius and typography of the theme it advertises — not a mockup.
 * Selection applies instantly; the dialog stays open for comparing.
 */
@Component({
  selector: 'app-theme-modal',
  imports: [Modal, NgIcon],
  providers: [provideIcons({ lucideCheck, lucideMonitor, lucideMoon, lucideSun })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [open]="open()"
      size="lg"
      title="Appearance"
      subtitle="Pick a personality for your workspace — changes apply instantly"
      (closed)="closed.emit()"
    >
      <!-- Mode -->
      <p class="mb-2 text-sm font-medium text-foreground">Mode</p>
      <div class="mb-6 grid grid-cols-3 gap-2">
        @for (m of theme.modes; track m.id) {
          <button
            type="button"
            (click)="setMode(m.id)"
            class="flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm
                   font-medium transition-colors"
            [class.border-primary]="theme.mode() === m.id"
            [class.bg-primary/5]="theme.mode() === m.id"
            [class.text-foreground]="theme.mode() === m.id"
            [class.border-border]="theme.mode() !== m.id"
            [class.text-muted-foreground]="theme.mode() !== m.id"
            [class.hover:bg-accent]="theme.mode() !== m.id"
          >
            <ng-icon [name]="m.icon" size="16" />
            {{ m.name }}
          </button>
        }
      </div>

      <!-- Themes -->
      <p class="mb-2 text-sm font-medium text-foreground">Theme</p>
      <div class="grid gap-4 sm:grid-cols-2">
        @for (t of theme.themes; track t.id) {
          <button
            type="button"
            (click)="setTheme(t.id)"
            class="group overflow-hidden rounded-xl border text-left transition-all hover:shadow-md"
            [class.border-primary]="theme.theme() === t.id"
            [class.ring-1]="theme.theme() === t.id"
            [class.ring-primary]="theme.theme() === t.id"
            [class.border-border]="theme.theme() !== t.id"
          >
            <!-- Live miniature preview, rendered in the theme's own tokens -->
            <div
              [attr.data-theme]="t.id"
              [class.dark]="theme.isDark()"
              class="pointer-events-none select-none border-b border-border"
              aria-hidden="true"
            >
              <div class="flex h-28" style="background: var(--background); font-family: var(--font-sans)">
                <!-- Sidebar -->
                <div
                  class="flex w-14 shrink-0 flex-col gap-1.5 p-2"
                  style="background: var(--sidebar); border-right: 1px solid var(--sidebar-border)"
                >
                  <div class="h-2 w-9" style="background: var(--sidebar-primary); border-radius: var(--radius)"></div>
                  <div class="h-2 w-7 opacity-70" style="background: var(--sidebar-accent); border-radius: var(--radius)"></div>
                  <div class="h-2 w-8 opacity-70" style="background: var(--sidebar-accent); border-radius: var(--radius)"></div>
                </div>
                <!-- Content -->
                <div class="flex min-w-0 flex-1 flex-col gap-2 p-2.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[10px] font-semibold leading-none" style="color: var(--foreground)">
                      {{ t.name }}
                    </span>
                    <div
                      class="flex h-4 w-12 items-center justify-center text-[7px] font-medium"
                      style="background: var(--primary); color: var(--primary-foreground); border-radius: var(--radius)"
                    >
                      Button
                    </div>
                  </div>
                  <div
                    class="flex flex-1 flex-col gap-1.5 p-2"
                    style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius)"
                  >
                    <div class="h-1.5 w-3/4" style="background: var(--muted-foreground); opacity: 0.55; border-radius: 2px"></div>
                    <div class="h-1.5 w-1/2" style="background: var(--muted); border-radius: 2px"></div>
                    <div class="h-1.5 w-2/3" style="background: var(--muted); border-radius: 2px"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Caption -->
            <div class="flex items-center gap-3 p-3">
              <span class="h-3.5 w-3.5 shrink-0 rounded-full" [style.background-color]="t.color"></span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-foreground">{{ t.name }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ t.description }}</span>
              </span>
              @if (theme.theme() === t.id) {
                <span
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary
                         text-primary-foreground"
                >
                  <ng-icon name="lucideCheck" size="13" />
                </span>
              }
            </div>
          </button>
        }
      </div>
    </app-modal>
  `,
})
export class ThemeModal {
  readonly theme = inject(ThemeService);

  /** Whether the dialog is shown. */
  readonly open = input.required<boolean>();
  /** Emitted when the user dismisses the dialog. */
  readonly closed = output<void>();

  setTheme(id: AppTheme): void {
    this.theme.setTheme(id);
  }

  setMode(id: ThemeMode): void {
    this.theme.setMode(id);
  }
}
