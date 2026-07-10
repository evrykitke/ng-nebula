import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideKeyRound, lucideShield, lucideUser } from '@ng-icons/lucide';
import { UiButton } from '../../shared/ui/button';
import { PageHeader } from '../../core/layout/page-header/page-header';
import { TwoFactorSetupCard } from '../../shared/components/two-factor-setup-card';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { apiErrorInfo } from '../../shared/api/api-error';
import { formatTimestamp } from '../../shared/util/dates';
import { AuthServiceProxy, Profile } from '../../shared/service-proxies/service-proxies';

/**
 * My Profile — the signed-in user's account: identity details from
 * `GET /auth/me`, password change, and two-factor enrollment (QR + one-time
 * recovery codes) or opt-out (password required; refused while the company
 * mandates 2FA).
 */
@Component({
  selector: 'app-profile-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader, TwoFactorSetupCard],
  providers: [provideIcons({ lucideKeyRound, lucideShield, lucideUser })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.page.html',
})
export class ProfilePage {
  private readonly proxy = inject(AuthServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  readonly tabs = [
    { id: 'profile' as const, label: 'Profile details', icon: 'lucideUser' },
    { id: 'security' as const, label: 'Security', icon: 'lucideShield' },
  ];
  readonly activeTab = signal<'profile' | 'security'>('profile');

  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(true);
  readonly savingPassword = signal(false);

  /** True while the 2FA enrollment card is shown. */
  readonly enrolling = signal(false);
  readonly disabling = signal(false);
  readonly twoFactorBusy = signal(false);
  /** Company-wide 2FA mandate: opting out is not offered while it is on. */
  readonly mandated = signal(false);

  readonly memberSince = computed(() => formatTimestamp(this.profile()?.created_at, 'yyyy-LL-dd'));
  readonly lastLogin = computed(() =>
    formatTimestamp(this.profile()?.last_login_at, 'yyyy-LL-dd HH:mm'),
  );

  // Password fields.
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  // 2FA disable confirmation.
  disablePassword = '';

  constructor() {
    this.load();
    this.proxy.tenant_two_factor_get().subscribe({
      next: (res) => this.mandated.set(res.require_two_factor),
      error: () => {
        /* single-tenant mode has no mandate; keep the opt-out available */
      },
    });
  }

  private load(): void {
    this.proxy.me().subscribe({
      next: (profile) => {
        this.hydrate(profile);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Failed to load your profile');
      },
    });
  }

  private hydrate(profile: Profile): void {
    this.profile.set(profile);
    // Keep the topbar's name/email in sync with the freshest server state.
    this.auth.setUser(profile);
  }

  setTab(tab: 'profile' | 'security'): void {
    this.activeTab.set(tab);
  }

  changePassword(): void {
    if (this.savingPassword()) return;
    if (!this.currentPassword || !this.newPassword) {
      this.notify.error('Enter your current and new password');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.notify.error('New password and confirmation do not match');
      return;
    }
    this.savingPassword.set(true);
    this.proxy
      .change_password({
        current_password: this.currentPassword,
        new_password: this.newPassword,
      })
      .subscribe({
        next: (profile) => {
          this.savingPassword.set(false);
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          this.hydrate(profile);
          this.notify.success('Password changed');
        },
        error: (err: unknown) => {
          this.savingPassword.set(false);
          this.notify.error(apiErrorInfo(err).message || 'Could not change your password');
        },
      });
  }

  /** Enrollment finished (recovery codes acknowledged): refresh the profile. */
  enrollmentDone(): void {
    this.enrolling.set(false);
    this.load();
    this.notify.success('Two-factor authentication enabled');
  }

  disableTwoFactor(): void {
    if (this.twoFactorBusy()) return;
    if (!this.disablePassword) {
      this.notify.error('Enter your password to disable two-factor authentication');
      return;
    }
    this.twoFactorBusy.set(true);
    this.proxy.two_factor_disable({ password: this.disablePassword }).subscribe({
      next: (profile) => {
        this.twoFactorBusy.set(false);
        this.disabling.set(false);
        this.disablePassword = '';
        this.hydrate(profile);
        this.notify.success('Two-factor authentication disabled');
      },
      error: (err: unknown) => {
        this.twoFactorBusy.set(false);
        this.notify.error(
          apiErrorInfo(err).message || 'Could not disable two-factor authentication',
        );
      },
    });
  }
}
