import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideInfo,
  lucideTriangleAlert,
  lucideCircleX,
  lucideX,
} from '@ng-icons/lucide';
import { NotificationService, ToastSeverity } from '../../core/services/notification.service';

const ICONS: Record<ToastSeverity, string> = {
  success: 'lucideCheck',
  info: 'lucideInfo',
  warn: 'lucideTriangleAlert',
  error: 'lucideCircleX',
};

const ACCENT: Record<ToastSeverity, string> = {
  success: 'text-success',
  info: 'text-info',
  warn: 'text-warning',
  error: 'text-destructive',
};

/** Fixed bottom-right toast host. */
@Component({
  selector: 'app-toaster',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provideIcons({ lucideCheck, lucideInfo, lucideTriangleAlert, lucideCircleX, lucideX }),
  ],
  template: `
    <div class="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      @for (t of notifications.toasts(); track t.id) {
        <div
          class="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border bg-popover
                 p-3 shadow-lg"
        >
          <ng-icon [name]="icon(t.severity)" [class]="accent(t.severity)" size="18" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-popover-foreground">{{ t.summary }}</p>
            @if (t.detail) {
              <p class="mt-0.5 text-xs text-muted-foreground">{{ t.detail }}</p>
            }
          </div>
          <button
            type="button"
            (click)="notifications.dismiss(t.id)"
            class="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <ng-icon name="lucideX" size="16" />
          </button>
        </div>
      }
    </div>
  `,
})
export class Toaster {
  readonly notifications = inject(NotificationService);

  icon(s: ToastSeverity): string {
    return ICONS[s];
  }
  accent(s: ToastSeverity): string {
    return ACCENT[s];
  }
}
