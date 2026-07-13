import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { switchMap } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button';
import { Brand } from '../../../../shared/ui/brand';
import { AuthBackdrop } from '../auth-backdrop';
import { Lookup } from '../../../../shared/lookup/lookup';
import { currencyLookup } from '../../../../shared/lookup/entity-lookups';
import {
  AuthServiceProxy,
  CurrencyServiceProxy,
  RegisterRequest,
} from '../../../../shared/service-proxies/service-proxies';
import { AuthService } from '../../auth.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';

/** The onboarding steps, in order. */
type Step = 'company' | 'administrator' | 'currency';

/** How long the setup screen stays up, minimum, even when the server is faster. */
const SETUP_MS = 10_000;

/** What the gears narrate, in order — one line per quarter of SETUP_MS. */
const SETUP_MESSAGES = [
  'Creating your company…',
  'Provisioning a dedicated database…',
  'Preparing your chart of accounts…',
  'Signing you in…',
] as const;

/**
 * Company onboarding, in three steps.
 *
 * The company and its administrator are collected first and submitted
 * together — that call creates the tenant and its admin account, and signs
 * the admin straight in. The currency comes after, deliberately: it is the
 * first decision made *inside* the new company rather than a condition of
 * creating it, and by then the request carries a real workspace and session.
 * It is skippable; a company that skips it keeps the default and sets one in
 * settings later. Either way the ledger follows — the chart of accounts is
 * re-denominated when the currency lands.
 *
 * The workspace identifier is derived from the company name (lowercase
 * letters, digits, dashes) but stays editable until the user touches it.
 *
 * While the company is being created the form gives way to a setup screen —
 * rotating gears and a cycle of status lines that mirror what the backend is
 * actually doing (provisioning a database, migrating, seeding, signing in).
 * The screen is held for at least SETUP_MS even when the server is quicker,
 * so the workspace never appears to materialise out of thin air.
 */
@Component({
  selector: 'app-register-page',
  imports: [FormsModule, RouterLink, UiButton, Brand, AuthBackdrop, Lookup, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-backdrop>
      <div class="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-sm">
        <app-brand class="mb-5 block" />

        <!-- Step indicator: done · current · pending -->
        <ol class="mb-6 flex items-center gap-2 text-xs font-medium">
          @for (s of steps; track s.id; let i = $index) {
            <li class="flex flex-1 items-center gap-2">
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]"
                [class]="
                  index() > i
                    ? 'border-primary bg-primary text-primary-foreground'
                    : index() === i
                      ? 'border-primary text-primary'
                      : 'border-border text-muted-foreground'
                "
              >
                {{ index() > i ? '✓' : i + 1 }}
              </span>
              <span [class]="index() === i ? 'text-foreground' : 'text-muted-foreground'">
                {{ s.label }}
              </span>
              @if (i < steps.length - 1) {
                <span class="ml-1 h-px flex-1 bg-border"></span>
              }
            </li>
          }
        </ol>

        @if (provisioning()) {
          <!-- Setup screen: a gear train turning while the workspace is provisioned. -->
          <div class="flex flex-col items-center px-4 py-12 text-center">
            <div class="relative h-20 w-24">
              <ng-icon
                name="lucideSettings"
                size="56"
                class="absolute left-3 top-0 text-primary motion-safe:animate-[spin_2.5s_linear_infinite]"
              />
              <ng-icon
                name="lucideSettings"
                size="30"
                class="absolute bottom-0 right-3 text-muted-foreground motion-safe:animate-[spin_2.5s_linear_infinite_reverse]"
              />
            </div>
            <h1 class="mt-6 text-xl font-semibold text-foreground">Setting up your workspace…</h1>
            <p class="mt-2 min-h-5 text-sm text-muted-foreground">{{ setupMessage() }}</p>
          </div>
        } @else {
          @switch (step()) {
            @case ('company') {
              <form (ngSubmit)="toAdministrator()">
                <h1 class="text-xl font-semibold text-foreground">Create your company</h1>
                <p class="mb-5 text-sm text-muted-foreground">
                  Set up a workspace and its administrator account — you can invite your team
                  afterwards.
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

                <label class="mb-1.5 block text-sm font-medium text-foreground">
                  Workspace identifier
                </label>
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
                  Lowercase letters, digits and dashes. Your team never has to remember it — signing
                  in only needs an email and password.
                </p>

                @if (error(); as message) {
                  <p class="mb-4 text-sm text-destructive">{{ message }}</p>
                }

                <button uiBtn type="submit" class="w-full">Continue</button>

                <p class="mt-4 text-center text-sm text-muted-foreground">
                  Already have an account?
                  <a routerLink="/login" class="font-medium text-foreground hover:underline">
                    Sign in
                  </a>
                </p>
              </form>
            }

            @case ('administrator') {
              <form (ngSubmit)="createCompany()">
                <h1 class="text-xl font-semibold text-foreground">Administrator account</h1>
                <p class="mb-5 text-sm text-muted-foreground">
                  This account administers <span class="text-foreground">{{ companyName() }}</span
                  >. You can add the rest of your team once you are in.
                </p>

                <div class="mb-4 grid grid-cols-2 gap-3">
                  <div>
                    <label class="mb-1.5 block text-sm font-medium text-foreground"
                      >First name</label
                    >
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
                    <label class="mb-1.5 block text-sm font-medium text-foreground"
                      >Last name</label
                    >
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

                <label class="mb-1.5 block text-sm font-medium text-foreground">
                  Confirm password
                </label>
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

                <div class="flex gap-3">
                  <button
                    uiBtn
                    variant="outline"
                    type="button"
                    [disabled]="loading()"
                    (click)="back()"
                  >
                    Back
                  </button>
                  <button uiBtn type="submit" class="flex-1" [disabled]="loading()">
                    {{ loading() ? 'Creating your workspace…' : 'Create company' }}
                  </button>
                </div>
              </form>
            }

            @case ('currency') {
              <form (ngSubmit)="finish()">
                <h1 class="text-xl font-semibold text-foreground">Choose your currency</h1>
                <p class="mb-5 text-sm text-muted-foreground">
                  <span class="text-foreground">{{ companyName() }}</span> is ready. Pick the
                  currency it trades in and its chart of accounts is denominated in it.
                </p>

                <label class="mb-1.5 block text-sm font-medium text-foreground">Currency</label>
                <app-lookup [config]="currencies" [(value)]="currency" class="mb-1 block" />
                <p class="mb-4 text-xs text-muted-foreground">
                  Set it now, while the books are empty — changing it after you have posted entries
                  means restating them.
                </p>

                @if (error(); as message) {
                  <p class="mb-4 text-sm text-destructive">{{ message }}</p>
                }

                <div class="flex gap-3">
                  <button uiBtn type="submit" class="flex-1" [disabled]="loading() || !currency">
                    {{ loading() ? 'Saving…' : 'Finish' }}
                  </button>
                  <button
                    uiBtn
                    variant="ghost"
                    type="button"
                    [disabled]="loading()"
                    (click)="skip()"
                  >
                    Skip for now
                  </button>
                </div>
              </form>
            }
          }
        }
      </div>
    </app-auth-backdrop>
  `,
})
export class RegisterPage implements OnDestroy {
  private readonly proxy = inject(AuthServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly steps: readonly { id: Step; label: string }[] = [
    { id: 'company', label: 'Company' },
    { id: 'administrator', label: 'Administrator' },
    { id: 'currency', label: 'Currency' },
  ];

  readonly step = signal<Step>('company');
  protected readonly index = computed(() => this.steps.findIndex((s) => s.id === this.step()));

  readonly companyName = signal('');
  readonly workspace = signal('');
  /** Stop deriving the identifier once the user edits it themselves. */
  private workspaceTouched = false;

  readonly currencies = currencyLookup(inject(CurrencyServiceProxy));
  currency: string | null = null;

  firstName = '';
  lastName = '';
  email = '';
  password = '';
  confirmPassword = '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** True while the workspace is being provisioned — shows the gear screen. */
  readonly provisioning = signal(false);
  readonly setupMessage = signal<string>(SETUP_MESSAGES[0]);
  private setupTicker: ReturnType<typeof setInterval> | undefined;
  private setupHold: ReturnType<typeof setTimeout> | undefined;

  ngOnDestroy(): void {
    this.stopSetupScreen();
  }

  companyNameChanged(value: string): void {
    this.companyName.set(value);
    if (!this.workspaceTouched) this.workspace.set(slugify(value));
  }

  workspaceChanged(value: string): void {
    this.workspaceTouched = value.length > 0;
    this.workspace.set(value);
  }

  back(): void {
    this.error.set(null);
    this.step.set('company');
  }

  toAdministrator(): void {
    const message = this.validateCompany();
    if (message) {
      this.error.set(message);
      return;
    }
    this.error.set(null);
    this.step.set('administrator');
  }

  /** Creates the tenant and its admin, then signs the admin in. */
  createCompany(): void {
    if (this.loading()) return;
    const message = this.validateAdministrator();
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
    const startedAt = Date.now();
    this.startSetupScreen();
    this.proxy
      .register(body)
      .pipe(switchMap(() => this.auth.login(this.email.trim(), this.password, this.workspace())))
      .subscribe({
        next: () => {
          // Hold the setup screen until SETUP_MS has passed, then move on.
          const remaining = Math.max(0, SETUP_MS - (Date.now() - startedAt));
          this.setupHold = setTimeout(() => {
            this.stopSetupScreen();
            this.loading.set(false);
            this.step.set('currency');
          }, remaining);
        },
        error: (err: unknown) => {
          this.stopSetupScreen();
          this.loading.set(false);
          this.error.set(this.messageFor(err));
        },
      });
  }

  /** Bring up the gear screen and start it narrating, one line per quarter. */
  private startSetupScreen(): void {
    this.setupMessage.set(SETUP_MESSAGES[0]);
    this.provisioning.set(true);
    let at = 0;
    this.setupTicker = setInterval(() => {
      // Stay on the last line however long the server takes.
      if (at < SETUP_MESSAGES.length - 1) this.setupMessage.set(SETUP_MESSAGES[++at]);
    }, SETUP_MS / SETUP_MESSAGES.length);
  }

  private stopSetupScreen(): void {
    if (this.setupTicker !== undefined) clearInterval(this.setupTicker);
    if (this.setupHold !== undefined) clearTimeout(this.setupHold);
    this.setupTicker = this.setupHold = undefined;
    this.provisioning.set(false);
  }

  /** The company exists and we are signed in as its admin: set its currency. */
  finish(): void {
    if (this.loading() || !this.currency) return;
    this.loading.set(true);
    this.error.set(null);
    this.proxy
      .tenant_profile_update({
        display_name: this.companyName().trim(),
        default_currency: this.currency,
      })
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

  /** The company is already created; the currency can wait for settings. */
  skip(): void {
    void this.router.navigateByUrl(this.auth.landingUrl());
  }

  private validateCompany(): string | null {
    if (!this.companyName().trim()) return 'Company name is required.';
    if (!/^[a-z0-9-]{1,64}$/.test(this.workspace())) {
      return 'The workspace identifier must be lowercase letters, digits or dashes.';
    }
    return null;
  }

  private validateAdministrator(): string | null {
    if (!this.firstName.trim() || !this.lastName.trim()) return 'Your name is required.';
    if (!this.email.trim().includes('@')) return 'Enter a valid email address.';
    if (this.password.length < 8) return 'The password must be at least 8 characters.';
    if (this.password !== this.confirmPassword) return 'The passwords do not match.';
    return null;
  }

  private messageFor(err: unknown): string {
    const info = apiErrorInfo(err);
    if (info.status === 409) {
      this.step.set('company');
      return 'That workspace identifier is already taken — pick another.';
    }
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
