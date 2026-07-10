import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UiButton } from '../../../../shared/ui/button';
import { AuthBackdrop } from '../auth-backdrop';
import { TwoFactorSetupCard } from '../../../../shared/components/two-factor-setup-card';
import { AuthService } from '../../auth.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { LoginResult } from '../../auth.model';
import { TenantChoice } from '../../../../shared/service-proxies/service-proxies';

type Step = 'credentials' | 'workspace' | 'code' | 'setup';

/**
 * Sign-in screen. Credentials only — the server resolves which company they
 * belong to. When the same credentials exist in several companies the user
 * picks the workspace; the two-factor branches follow the server's answer:
 * `two_factor_required` asks for an authenticator code,
 * `two_factor_setup_required` runs enrollment inline (company-mandated 2FA),
 * after which the user signs in again.
 */
@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink, UiButton, AuthBackdrop, TwoFactorSetupCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-backdrop>
      <div class="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <div class="mb-5 flex items-center gap-2.5">
          <span class="text-lg font-semibold text-foreground">Pylon</span>
        </div>

        @switch (step()) {
          @case ('credentials') {
            <form (ngSubmit)="signIn()">
              <h1 class="text-xl font-semibold text-foreground">Sign in</h1>
              <p class="mb-5 text-sm text-muted-foreground">Enter your credentials.</p>

              @if (notice(); as text) {
                <p class="mb-4 rounded-md border border-border bg-muted/40 p-2.5 text-sm text-foreground">
                  {{ text }}
                </p>
              }

              <label class="mb-1.5 block text-sm font-medium text-foreground">Username or email</label>
              <input
                [(ngModel)]="login"
                name="login"
                type="text"
                autocomplete="username"
                class="mb-4 h-9 w-full rounded-md border border-input bg-background px-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-ring"
              />

              <label class="mb-1.5 block text-sm font-medium text-foreground">Password</label>
              <input
                [(ngModel)]="password"
                name="password"
                type="password"
                autocomplete="current-password"
                class="mb-4 h-9 w-full rounded-md border border-input bg-background px-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-ring"
              />

              @if (error(); as message) {
                <p class="mb-4 text-sm text-destructive">{{ message }}</p>
              }

              <button uiBtn type="submit" class="w-full" [disabled]="loading()">
                {{ loading() ? 'Signing in…' : 'Sign in' }}
              </button>

              <p class="mt-4 text-center text-sm text-muted-foreground">
                New here?
                <a routerLink="/register" class="font-medium text-foreground hover:underline">
                  Create your company
                </a>
              </p>
            </form>
          }
          @case ('workspace') {
            <h1 class="text-xl font-semibold text-foreground">Choose a workspace</h1>
            <p class="mb-5 text-sm text-muted-foreground">
              Your account belongs to more than one company.
            </p>

            <div class="flex flex-col gap-2">
              @for (choice of workspaces(); track choice.name) {
                <button
                  type="button"
                  class="flex flex-col items-start rounded-md border border-border px-3 py-2 text-left
                         hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring"
                  [disabled]="loading()"
                  (click)="pickWorkspace(choice)"
                >
                  <span class="text-sm font-medium text-foreground">{{ choice.display_name }}</span>
                  <span class="text-xs text-muted-foreground">{{ choice.name }}</span>
                </button>
              }
            </div>

            @if (error(); as message) {
              <p class="mt-4 text-sm text-destructive">{{ message }}</p>
            }

            <button
              type="button"
              class="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              (click)="backToCredentials()"
            >
              Back to sign in
            </button>
          }
          @case ('code') {
            <form (ngSubmit)="verifyCode()">
              <h1 class="text-xl font-semibold text-foreground">Two-factor code</h1>
              <p class="mb-5 text-sm text-muted-foreground">
                Enter the code from your authenticator app, or a recovery code.
              </p>

              <label class="mb-1.5 block text-sm font-medium text-foreground">Code</label>
              <input
                [(ngModel)]="code"
                name="code"
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

              <button uiBtn type="submit" class="w-full" [disabled]="loading()">
                {{ loading() ? 'Verifying…' : 'Verify' }}
              </button>
              <button
                type="button"
                class="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
                (click)="backToCredentials()"
              >
                Back to sign in
              </button>
            </form>
          }
          @case ('setup') {
            <app-two-factor-setup-card (completed)="setupDone()" />
            <button
              type="button"
              class="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              (click)="backToCredentials()"
            >
              Back to sign in
            </button>
          }
        }
      </div>
    </app-auth-backdrop>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  login = '';
  password = '';
  code = '';

  readonly step = signal<Step>('credentials');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Informational banner on the credentials step (e.g. after 2FA enrollment). */
  readonly notice = signal<string | null>(null);
  /** Companies the credentials matched, when the login is ambiguous. */
  readonly workspaces = signal<TenantChoice[]>([]);

  signIn(): void {
    if (this.loading()) return;
    if (!this.login.trim() || !this.password) {
      this.error.set('Username and password are required.');
      return;
    }
    this.notice.set(null);
    this.submit(this.auth.login(this.login.trim(), this.password));
  }

  /** Ambiguous login: retry scoped to the chosen company. */
  pickWorkspace(choice: TenantChoice): void {
    if (this.loading()) return;
    this.submit(this.auth.login(this.login.trim(), this.password, choice.name));
  }

  private submit(request: ReturnType<AuthService['login']>): void {
    this.loading.set(true);
    this.error.set(null);
    request.subscribe({
      next: (result: LoginResult) => {
        this.loading.set(false);
        if (result.status === 'success') {
          void this.router.navigateByUrl(this.auth.landingUrl());
        } else if (result.status === 'tenant_selection') {
          this.workspaces.set(result.tenants);
          this.step.set('workspace');
        } else if (result.status === 'two_factor_required') {
          this.code = '';
          this.step.set('code');
        } else {
          // The company mandates 2FA and this account has none yet.
          this.step.set('setup');
        }
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(this.messageFor(err));
      },
    });
  }

  verifyCode(): void {
    if (this.loading()) return;
    if (!this.code.trim()) {
      this.error.set('Enter your two-factor code.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.auth.loginTwoFactor(this.code.trim()).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigateByUrl(this.auth.landingUrl());
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const info = apiErrorInfo(err);
        this.error.set(
          info.status === 401 ? 'That code is not valid — try the current one.' : this.messageFor(err),
        );
      },
    });
  }

  /** Enrollment done; the bridge token is spent, so sign in again. */
  setupDone(): void {
    this.backToCredentials();
    this.notice.set('Two-factor authentication is enabled. Sign in again to continue.');
  }

  backToCredentials(): void {
    this.step.set('credentials');
    this.error.set(null);
    this.password = '';
    this.code = '';
    this.workspaces.set([]);
  }

  private messageFor(err: unknown): string {
    const info = apiErrorInfo(err);
    if (info.status === 401) return 'Invalid username or password.';
    if (info.status === 403) return 'This workspace is not active.';
    if (info.status === 423) return 'This account is temporarily locked — try again shortly.';
    if (info.status === 0) return 'Cannot reach the server.';
    return info.message || 'Sign-in failed. Please try again.';
  }
}
