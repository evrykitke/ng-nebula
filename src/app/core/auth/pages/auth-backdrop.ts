import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Full-screen backdrop for the auth pages (sign-in, onboarding): a subtle
 * square grid drawn from the theme's border colour that fades out toward the
 * edges, with a faint primary-tinted glow behind the centered card — the
 * graph-paper look. Pages project their card as content; it keeps its own
 * width.
 */
@Component({
  selector: 'app-auth-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div class="auth-grid pointer-events-none absolute inset-0" aria-hidden="true"></div>
      <div class="auth-glow pointer-events-none absolute inset-0" aria-hidden="true"></div>
      <div class="relative flex w-full justify-center">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .auth-grid {
      background-image:
        linear-gradient(
          to right,
          color-mix(in srgb, var(--border) 80%, transparent) 1px,
          transparent 1px
        ),
        linear-gradient(
          to bottom,
          color-mix(in srgb, var(--border) 80%, transparent) 1px,
          transparent 1px
        );
      background-size: 44px 44px;
      mask-image: radial-gradient(ellipse 95% 85% at 50% 42%, black 30%, transparent 100%);
    }
    .auth-glow {
      background: radial-gradient(
        640px 360px at 50% 38%,
        color-mix(in srgb, var(--primary) 9%, transparent),
        transparent 70%
      );
    }
  `,
})
export class AuthBackdrop {}
