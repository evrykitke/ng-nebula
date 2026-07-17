import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '../../../shared/ui/button';
import { PageSkeleton } from '../../../shared/ui/skeleton';
import { NotificationService } from '../../../core/services/notification.service';
import { apiErrorInfo } from '../../../shared/api/api-error';
import {
  AuthServiceProxy,
  Encryption,
  MailSettings,
  MailSettingsInput,
} from '../../../shared/service-proxies/service-proxies';

/**
 * The company's SMTP server.
 *
 * The password is write-only: the server reports only whether one is set,
 * so this form never holds it. Leaving the field untouched therefore
 * *keeps* the stored password rather than clearing it — which is why the
 * password is sent only when the admin actually typed something.
 *
 * "Send test" posts the form as it stands rather than what is saved, so a
 * server can be proved before it is committed to.
 */
@Component({
  selector: 'app-mail-settings-card',
  imports: [PageSkeleton, FormsModule, UiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="text-sm font-semibold text-foreground">Email (SMTP)</h2>
    <p class="mt-1 mb-4 text-sm text-muted-foreground">
      The mail server this workspace sends through, so mail arrives from your own domain.
    </p>

    @if (loading()) {
      <app-page-skeleton variant="form" [rows]="3" />
    } @else {
      <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" (ngSubmit)="save()">
        <div class="sm:col-span-2">
          <label class="mb-1.5 block text-sm font-medium">Host</label>
          <input
            [(ngModel)]="host"
            name="host"
            type="text"
            placeholder="e.g. smtp.gmail.com"
            class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium">Port</label>
          <input
            [(ngModel)]="port"
            name="port"
            type="number"
            [min]="1"
            [max]="65535"
            class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium">Security</label>
          <select
            [(ngModel)]="encryption"
            name="encryption"
            (ngModelChange)="onEncryptionChange($event)"
            class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="starttls">STARTTLS (usually port 587)</option>
            <option value="tls">TLS (usually port 465)</option>
            <option value="none">None — not encrypted</option>
          </select>
          @if (encryption === 'none') {
            <p class="mt-1 text-xs text-warning">
              The password will cross the network in the clear. Only for a relay you control.
            </p>
          }
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium">Username</label>
          <input
            [(ngModel)]="username"
            name="username"
            type="text"
            autocomplete="off"
            placeholder="blank if the server needs no sign-in"
            class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium">Password</label>
          <input
            [(ngModel)]="password"
            name="password"
            type="password"
            autocomplete="new-password"
            [placeholder]="passwordSet() ? '•••••••• (unchanged)' : 'none set'"
            class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <p class="mt-1 text-xs text-muted-foreground">
            @if (passwordSet()) {
              Stored and encrypted. Leave blank to keep it;
              <button type="button" class="underline" (click)="clearPassword()">clear it</button>
              to remove it.
            } @else {
              Stored encrypted. It is never shown again once saved.
            }
          </p>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium">From address</label>
          <input
            [(ngModel)]="fromAddress"
            name="fromAddress"
            type="email"
            placeholder="e.g. billing@company.com"
            class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium">From name</label>
          <input
            [(ngModel)]="fromName"
            name="fromName"
            type="text"
            placeholder="e.g. Acme Billing"
            class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        <label class="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" class="size-4" [(ngModel)]="enabled" name="enabled" />
          Send outbound mail
          <span class="text-xs text-muted-foreground">
            — off keeps these settings but stops anything going out.
          </span>
        </label>

        <div class="rounded-md border border-border bg-muted/30 p-3 sm:col-span-2">
          <label class="mb-1.5 block text-sm font-medium">Send a test message to</label>
          <div class="flex gap-2">
            <input
              [(ngModel)]="testTo"
              name="testTo"
              type="email"
              placeholder="you@company.com"
              class="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            />
            <button uiBtn variant="outline" type="button" (click)="test()" [disabled]="testing()">
              {{ testing() ? 'Sending…' : 'Send test' }}
            </button>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            Uses the settings above as they stand, saved or not.
          </p>
        </div>

        <div class="flex items-center justify-end sm:col-span-2">
          <button uiBtn type="submit" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save email settings' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class MailSettingsCard {
  private readonly auth = inject(AuthServiceProxy);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly passwordSet = signal(false);

  host = '';
  port = 587;
  username = '';
  password = '';
  encryption: Encryption = 'starttls';
  fromAddress = '';
  fromName = '';
  enabled = true;
  testTo = '';

  constructor() {
    this.auth.mail_settings_get().subscribe({
      next: (res) => {
        if (res.settings) this.apply(res.settings);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.notify.error('Could not load the email settings', apiErrorInfo(err).message);
      },
    });
  }

  private apply(s: MailSettings): void {
    this.host = s.host;
    this.port = s.port;
    this.username = s.username ?? '';
    this.encryption = s.encryption;
    this.fromAddress = s.from_address;
    this.fromName = s.from_name ?? '';
    this.enabled = s.enabled;
    this.passwordSet.set(s.password_set);
    this.password = '';
  }

  /** The conventional port for the chosen security, unless it was set. */
  onEncryptionChange(value: Encryption): void {
    if (value === 'tls' && this.port === 587) this.port = 465;
    else if (value === 'starttls' && this.port === 465) this.port = 587;
  }

  /**
   * An empty string means "clear it" to the server, whereas leaving the
   * field alone (undefined) means "keep it" — so removing a password has
   * to be an explicit act.
   */
  clearPassword(): void {
    this.password = '';
    this.passwordSet.set(false);
    this.notify.info('The password will be removed when you save.');
  }

  private input(): MailSettingsInput {
    return {
      host: this.host.trim(),
      port: this.port,
      username: this.username.trim() || undefined,
      // Untouched: withhold it and the server keeps what it has. Cleared:
      // send "" to remove it.
      password: this.password ? this.password : this.passwordSet() ? undefined : '',
      encryption: this.encryption,
      from_address: this.fromAddress.trim(),
      from_name: this.fromName.trim() || undefined,
      enabled: this.enabled,
    };
  }

  save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.auth.mail_settings_update(this.input()).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.settings) this.apply(res.settings);
        this.notify.success('Email settings saved');
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.notify.error('Could not save the email settings', apiErrorInfo(err).message);
      },
    });
  }

  test(): void {
    if (this.testing()) return;
    const to = this.testTo.trim();
    if (!to) {
      this.notify.error('Enter an address to send the test to.');
      return;
    }
    this.testing.set(true);
    this.auth.mail_settings_test({ to, settings: this.input() }).subscribe({
      next: () => {
        this.testing.set(false);
        this.notify.success('Test message sent', `Check ${to}.`);
      },
      error: (err: unknown) => {
        this.testing.set(false);
        // The mail server's own words: "authentication failed" and
        // "connection refused" send an admin to different places.
        this.notify.error('The test message did not go out', apiErrorInfo(err).message);
      },
    });
  }
}
