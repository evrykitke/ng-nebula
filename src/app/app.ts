import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { Toaster } from './shared/ui/toaster';
import { ConfirmDialog } from './shared/ui/confirm-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toaster, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-toaster />
    <app-confirm-dialog />
  `,
})
export class App {
  // Inject so the theme effect is active for the lifetime of the app.
  private readonly theme = inject(ThemeService);
}
