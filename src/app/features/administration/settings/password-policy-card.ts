import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '../../../shared/ui/button';
import { PageSkeleton } from '../../../shared/ui/skeleton';
import { NotificationService } from '../../../core/services/notification.service';
import { apiErrorInfo } from '../../../shared/api/api-error';
import {
  AuthServiceProxy,
  PasswordPolicyResponse,
} from '../../../shared/service-proxies/service-proxies';

/**
 * The company password policy.
 *
 * Every rule is an *override*: leaving a number blank, or a checkbox
 * inherited, means the rule follows the deployment and keeps following it
 * if the deployment changes. That distinction is the whole point of the
 * panel, so the form models it directly rather than pre-filling the
 * deployment's numbers and quietly pinning them the first time someone
 * hits Save.
 *
 * The deployment's settings are a floor, not just a default — a company
 * can tighten a rule but not loosen it. The server refuses either way;
 * showing the floor here is what stops an admin discovering that by
 * being rejected.
 */
@Component({
  selector: 'app-password-policy-card',
  imports: [PageSkeleton, FormsModule, UiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="text-sm font-semibold text-foreground">Password policy</h2>
    <p class="mt-1 mb-4 text-sm text-muted-foreground">
      The rules everyone in the workspace meets when they set a password. Leave a field blank to
      follow the deployment default.
    </p>

    @if (data(); as d) {
      <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" (ngSubmit)="save()">
        <div>
          <label class="mb-1.5 block text-sm font-medium">Minimum length</label>
          <input
            [(ngModel)]="minLength"
            name="minLength"
            type="number"
            [min]="d.floor.min_length"
            [placeholder]="'default: ' + d.floor.min_length"
            class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <p class="mt-1 text-xs text-muted-foreground">
            At least {{ d.floor.min_length }} — the deployment's floor.
          </p>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium">Expires after (days)</label>
          <input
            [(ngModel)]="expiryDays"
            name="expiryDays"
            type="number"
            [min]="0"
            [placeholder]="d.floor.expiry_days === 0 ? 'default: never' : 'default: ' + d.floor.expiry_days"
            class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <p class="mt-1 text-xs text-muted-foreground">
            0 never expires. Users are made to change it at their next sign-in.
          </p>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium">Previous passwords remembered</label>
          <input
            [(ngModel)]="historyCount"
            name="historyCount"
            type="number"
            [min]="d.floor.history_count"
            [placeholder]="'default: ' + d.floor.history_count"
            class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <p class="mt-1 text-xs text-muted-foreground">0 allows reuse.</p>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="mb-1.5 block text-sm font-medium">Lock after</label>
            <input
              [(ngModel)]="lockoutMaxFailed"
              name="lockoutMaxFailed"
              type="number"
              [min]="1"
              [max]="d.floor.lockout_max_failed"
              [placeholder]="'default: ' + d.floor.lockout_max_failed"
              class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            <p class="mt-1 text-xs text-muted-foreground">failed tries</p>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium">Lock for</label>
            <input
              [(ngModel)]="lockoutSecs"
              name="lockoutSecs"
              type="number"
              [min]="d.floor.lockout_secs"
              [placeholder]="'default: ' + d.floor.lockout_secs"
              class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            <p class="mt-1 text-xs text-muted-foreground">seconds</p>
          </div>
        </div>

        <fieldset class="sm:col-span-2">
          <legend class="mb-1.5 text-sm font-medium">Must contain</legend>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            @for (rule of rules; track rule.key) {
              <label
                class="flex cursor-pointer items-center gap-2 rounded-md border border-border
                       bg-muted/30 px-3 py-2 text-sm"
                [class.opacity-60]="locked(rule.key)"
                [title]="locked(rule.key) ? 'Required by the deployment; it cannot be switched off here.' : ''"
              >
                <!--
                  attr.name as well as name: the binding registers the
                  control with ngModel but sets only the DOM property, so
                  without it the rendered input carries no name attribute
                  for a selector — or a person reading the DOM — to find.
                -->
                <input
                  type="checkbox"
                  class="size-4"
                  [ngModel]="classes[rule.key]"
                  (ngModelChange)="classes[rule.key] = $event"
                  [name]="rule.key"
                  [attr.name]="rule.key"
                  [disabled]="locked(rule.key)"
                />
                {{ rule.label }}
              </label>
            }
          </div>
        </fieldset>

        <div class="flex items-center justify-between gap-3 sm:col-span-2">
          <button uiBtn variant="ghost" size="sm" type="button" (click)="inherit()">
            Follow the deployment
          </button>
          <button uiBtn type="submit" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save password policy' }}
          </button>
        </div>
      </form>
    } @else {
      <app-page-skeleton variant="form" [rows]="3" />
    }
  `,
})
export class PasswordPolicyCard {
  private readonly auth = inject(AuthServiceProxy);
  private readonly notify = inject(NotificationService);

  readonly data = signal<PasswordPolicyResponse | null>(null);
  readonly saving = signal(false);

  readonly rules = [
    { key: 'require_uppercase', label: 'Uppercase' },
    { key: 'require_lowercase', label: 'Lowercase' },
    { key: 'require_digit', label: 'A digit' },
    { key: 'require_symbol', label: 'A symbol' },
  ] as const;

  minLength: number | null = null;
  expiryDays: number | null = null;
  historyCount: number | null = null;
  lockoutMaxFailed: number | null = null;
  lockoutSecs: number | null = null;
  classes: Record<string, boolean> = {};

  constructor() {
    this.load();
  }

  private load(): void {
    this.auth.password_policy_get().subscribe({
      next: (res) => this.apply(res),
      error: (err: unknown) =>
        this.notify.error('Could not load the password policy', apiErrorInfo(err).message),
    });
  }

  private apply(res: PasswordPolicyResponse): void {
    this.data.set(res);
    const o = res.overrides;
    this.minLength = o.min_length ?? null;
    this.expiryDays = o.expiry_days ?? null;
    this.historyCount = o.history_count ?? null;
    this.lockoutMaxFailed = o.lockout_max_failed ?? null;
    this.lockoutSecs = o.lockout_secs ?? null;
    // A checkbox cannot show "inherited", so it shows the rule in force.
    // Saving an inherited box that matches the floor sends null back —
    // see `classOverride`.
    for (const rule of this.rules) {
      this.classes[rule.key] = res.policy[rule.key] as boolean;
    }
  }

  /** A rule the deployment requires cannot be switched off here. */
  locked(key: string): boolean {
    return (this.data()?.floor[key] as boolean) ?? false;
  }

  /** Drop every override and go back to following the deployment. */
  inherit(): void {
    this.minLength = null;
    this.expiryDays = null;
    this.historyCount = null;
    this.lockoutMaxFailed = null;
    this.lockoutSecs = null;
    for (const rule of this.rules) {
      this.classes[rule.key] = (this.data()?.floor[rule.key] as boolean) ?? false;
    }
  }

  /**
   * Ticked when the deployment already requires it means "inherited", not
   * "the company insists" — sending null keeps the company following the
   * deployment if it ever relaxes.
   */
  private classOverride(key: string): boolean | undefined {
    const floor = (this.data()?.floor[key] as boolean) ?? false;
    const checked = this.classes[key] ?? false;
    return checked === floor ? undefined : checked;
  }

  save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.auth
      .password_policy_update({
        min_length: this.minLength ?? undefined,
        expiry_days: this.expiryDays ?? undefined,
        history_count: this.historyCount ?? undefined,
        lockout_max_failed: this.lockoutMaxFailed ?? undefined,
        lockout_secs: this.lockoutSecs ?? undefined,
        require_uppercase: this.classOverride('require_uppercase'),
        require_lowercase: this.classOverride('require_lowercase'),
        require_digit: this.classOverride('require_digit'),
        require_symbol: this.classOverride('require_symbol'),
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.apply(res);
          this.notify.success('Password policy updated');
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.notify.error('Could not update the password policy', apiErrorInfo(err).message);
        },
      });
  }
}
