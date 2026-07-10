import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button';
import { AuthBackdrop } from '../auth-backdrop';
import { AuthServiceProxy, RegisterRequest } from '../../../../shared/service-proxies/service-proxies';
import { AuthService } from '../../auth.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';

/**
 * Company onboarding. Creates the tenant and its admin account from the
 * email + password given here, then signs the new admin straight in. The
 * workspace identifier is derived from the company name (lowercase letters,
 * digits, dashes) but stays editable until the user touches it.
 */
@Component({
  selector: 'app-register-page',
  imports: [FormsModule, RouterLink, UiButton, AuthBackdrop],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-backdrop>
      <div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <div class="mb-5 flex items-center gap-2.5">
          <span class="text-lg font-semibold text-foreground">Pylon</span>
        </div>

        <form (ngSubmit)="submit()">
          <h1 class="text-xl font-semibold text-foreground">Create your company</h1>
          <p class="mb-5 text-sm text-muted-foreground">
            Set up a workspace and its administrator account — you can invite your team afterwards.
          </p>

          <label class="mb-1.5 block text-sm font-medium text-foreground">Company name</label>
          <input
            [ngModel]="companyName()"
            (ngModelChange)="companyNameChanged($event)"
            name="companyName"
            type="text"
            autocomplete="organization"
            class="mb-4 h-9 w-full rounded-md border border-input bg-background px-3 text-sm
                   focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <label class="mb-1.5 block text-sm font-medium text-foreground">Workspace identifier</label>
          <input
            [ngModel]="workspace()"
            (ngModelChange)="workspaceChanged($event)"
            name="workspace"
            type="text"
            placeholder="your-company"
            autocomplete="off"
            spellcheck="false"
            class="mb-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm
                   focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p class="mb-4 text-xs text-muted-foreground">
            Lowercase letters, digits and dashes. Your team never has to remember it — signing in
            only needs an email and password.
          </p>

          <div class="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-foreground">First name</label>
              <input
                [(ngModel)]="firstName"
                name="firstName"
                type="text"
                autocomplete="given-name"
                class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-foreground">Last name</label>
              <input
                [(ngModel)]="lastName"
                name="lastName"
                type="text"
                autocomplete="family-name"
                class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <label class="mb-1.5 block text-sm font-medium text-foreground">Email</label>
          <input
            [(ngModel)]="email"
            name="email"
            type="email"
            autocomplete="email"
            class="mb-4 h-9 w-full rounded-md border border-input bg-background px-3 text-sm
                   focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <label class="mb-1.5 block text-sm font-medium text-foreground">Password</label>
          <input
            [(ngModel)]="password"
            name="password"
            type="password"
            autocomplete="new-password"
            class="mb-4 h-9 w-full rounded-md border border-input bg-background px-3 text-sm
                   focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <label class="mb-1.5 block text-sm font-medium text-foreground">Confirm password</label>
          <input
            [(ngModel)]="confirmPassword"
            name="confirmPassword"
            type="password"
            autocomplete="new-password"
            class="mb-4 h-9 w-full rounded-md border border-input bg-background px-3 text-sm
                   focus:outline-none focus:ring-2 focus:ring-ring"
          />

          @if (error(); as message) {
            <p class="mb-4 text-sm text-destructive">{{ message }}</p>
          }

          <button uiBtn type="submit" class="w-full" [disabled]="loading()">
            {{ loading() ? 'Creating your workspace…' : 'Create company' }}
          </button>

          <p class="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?
            <a routerLink="/login" class="font-medium text-foreground hover:underline">Sign in</a>
          </p>
        </form>
      </div>
    </app-auth-backdrop>
  `,
})
export class RegisterPage {
  private readonly proxy = inject(AuthServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly companyName = signal('');
  readonly workspace = signal('');
  /** Stop deriving the identifier once the user edits it themselves. */
  private workspaceTouched = false;

  firstName = '';
  lastName = '';
  email = '';
  password = '';
  confirmPassword = '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  companyNameChanged(value: string): void {
    this.companyName.set(value);
    if (!this.workspaceTouched) this.workspace.set(slugify(value));
  }

  workspaceChanged(value: string): void {
    this.workspaceTouched = value.length > 0;
    this.workspace.set(value);
  }

  submit(): void {
    if (this.loading()) return;
    const message = this.validate();
    if (message) {
      this.error.set(message);
      return;
    }

    const body: RegisterRequest = {
      tenant_name: this.workspace(),
      company_display_name: this.companyName().trim(),
      email: this.email.trim(),
      password: this.password,
      first_name: this.firstName.trim(),
      last_name: this.lastName.trim(),
    };

    this.loading.set(true);
    this.error.set(null);
    this.proxy
      .register(body)
      .pipe(switchMap(() => this.auth.login(this.email.trim(), this.password, this.workspace())))
      .subscribe({
        next: () => {
          this.loading.set(false);
          void this.router.navigateByUrl(this.auth.landingUrl());
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(this.messageFor(err));
        },
      });
  }

  private validate(): string | null {
    if (!this.companyName().trim()) return 'Company name is required.';
    if (!/^[a-z0-9-]{1,64}$/.test(this.workspace())) {
      return 'The workspace identifier must be lowercase letters, digits or dashes.';
    }
    if (!this.firstName.trim() || !this.lastName.trim()) return 'Your name is required.';
    if (!this.email.trim().includes('@')) return 'Enter a valid email address.';
    if (this.password.length < 8) return 'The password must be at least 8 characters.';
    if (this.password !== this.confirmPassword) return 'The passwords do not match.';
    return null;
  }

  private messageFor(err: unknown): string {
    const info = apiErrorInfo(err);
    if (info.status === 409) return 'That workspace identifier is already taken — pick another.';
    if (info.status === 0) return 'Cannot reach the server.';
    return info.message || 'Registration failed. Please try again.';
  }
}

/** Company name → workspace identifier: lowercase letters, digits, dashes. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
