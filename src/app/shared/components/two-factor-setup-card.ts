import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as QRCode from 'qrcode';
import { AuthServiceProxy, TwoFactorSetup } from '../service-proxies/service-proxies';
import { apiErrorInfo } from '../api/api-error';
import { UiButton } from '../ui/button';

/**
 * Self-contained authenticator enrollment: fetches a fresh TOTP secret from
 * `POST /auth/two-factor/setup`, renders the otpauth URL as a QR code, verifies
 * the first code via `/auth/two-factor/confirm`, and shows the one-time
 * recovery codes. Works in both places 2FA gets enabled — the profile page
 * (with a full session) and the login flow (with the two-factor bridge token,
 * which the API interceptor attaches automatically).
 */
@Component({
  selector: 'app-two-factor-setup-card',
  imports: [FormsModule, UiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recoveryCodes(); as codes) {
      <h2 class="text-base font-semibold text-foreground">Save your recovery codes</h2>
      <p class="mt-1 mb-4 text-sm text-muted-foreground">
        Each code signs you in once if you lose your authenticator. They are shown only now.
      </p>
      <div class="mb-4 grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/40 p-3 font-mono text-sm">
        @for (code of codes; track code) {
          <span>{{ code }}</span>
        }
      </div>
      <button uiBtn variant="outline" type="button" class="mb-2 w-full" (click)="download()">
        Download codes
      </button>
      <button uiBtn type="button" class="w-full" (click)="completed.emit()">
        I have saved my recovery codes
      </button>
    } @else {
      <h2 class="text-base font-semibold text-foreground">Set up two-factor authentication</h2>
      <p class="mt-1 mb-4 text-sm text-muted-foreground">
        Scan the QR code with your authenticator app, then enter the 6-digit code it shows.
      </p>

      @if (qrDataUrl(); as qr) {
        <div class="mb-3 flex justify-center">
          <img [src]="qr" alt="Authenticator QR code" class="h-44 w-44 rounded-md border border-border bg-white p-2" />
        </div>
      }
      @if (setup(); as s) {
        <p class="mb-4 text-center text-xs text-muted-foreground">
          Can't scan? Enter this secret manually:
          <span class="font-mono text-foreground">{{ s.secret }}</span>
        </p>
      }

      <label class="mb-1.5 block text-sm font-medium text-foreground">Verification code</label>
      <input
        [(ngModel)]="code"
        name="totp-code"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        placeholder="123456"
        class="mb-4 h-9 w-full rounded-md border border-input bg-background px-3 text-sm
               focus:outline-none focus:ring-2 focus:ring-ring"
      />

      @if (error(); as message) {
        <p class="mb-4 text-sm text-destructive">{{ message }}</p>
      }

      <button uiBtn type="button" class="w-full" [disabled]="busy() || !setup()" (click)="confirm()">
        {{ busy() ? 'Verifying…' : 'Verify and enable' }}
      </button>
    }
  `,
})
export class TwoFactorSetupCard {
  private readonly proxy = inject(AuthServiceProxy);

  /** Fires after the user confirms they stored their recovery codes. */
  readonly completed = output<void>();

  readonly setup = signal<TwoFactorSetup | null>(null);
  readonly qrDataUrl = signal<string | null>(null);
  readonly recoveryCodes = signal<string[] | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  code = '';

  constructor() {
    this.proxy.two_factor_setup().subscribe({
      next: (setup) => {
        this.setup.set(setup);
        void QRCode.toDataURL(setup.otpauth_url, { margin: 1, width: 352 }).then(
          (url) => this.qrDataUrl.set(url),
          () => this.qrDataUrl.set(null),
        );
      },
      error: (err: unknown) => this.error.set(apiErrorInfo(err).message ?? 'Could not start setup.'),
    });
  }

  /** Save the recovery codes as a plain-text file. */
  download(): void {
    const codes = this.recoveryCodes();
    if (!codes) return;
    const content = [
      'Pylon two-factor recovery codes',
      `Generated ${new Date().toISOString().slice(0, 10)} — each code signs you in once.`,
      '',
      ...codes,
      '',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pylon-recovery-codes.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  confirm(): void {
    if (this.busy()) return;
    const code = this.code.trim();
    if (!code) {
      this.error.set('Enter the code from your authenticator app.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.proxy.two_factor_confirm({ code }).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.recoveryCodes.set(res.recovery_codes);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        const info = apiErrorInfo(err);
        this.error.set(info.status === 401 || info.status === 422 ? 'That code is not valid — try the current one.' : (info.message ?? 'Verification failed.'));
      },
    });
  }
}
