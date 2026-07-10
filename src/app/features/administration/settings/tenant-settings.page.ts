import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBuilding2, lucideUpload } from '@ng-icons/lucide';
import { UiButton } from '../../../shared/ui/button';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { apiErrorInfo } from '../../../shared/api/api-error';
import { Lookup } from '../../../shared/lookup/lookup';
import { currencyLookup } from '../../../shared/lookup/entity-lookups';
import { environment } from '../../../../environments/environment';
import {
  AuditServiceProxy,
  AuthServiceProxy,
  CompanyProfileResponse,
  CurrencyServiceProxy,
  RetentionResponse,
} from '../../../shared/service-proxies/service-proxies';

/**
 * Tenant Settings — what a tenant admin controls about the workspace: the
 * company information (display name, logo, tax identifiers, default
 * currency), the company 2FA mandate and the audit-trail retention
 * override. Database migrations are not a user concern — deployments
 * migrate every tenant automatically (boot auto-migrate + the tenant
 * migration job).
 */
@Component({
  selector: 'app-tenant-settings-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader, Lookup],
  providers: [provideIcons({ lucideBuilding2, lucideUpload })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tenant-settings.page.html',
})
export class TenantSettingsPage {
  private readonly auth = inject(AuthServiceProxy);
  private readonly audit = inject(AuditServiceProxy);
  private readonly currencyProxy = inject(CurrencyServiceProxy);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  // Company information.
  readonly currencies = currencyLookup(this.currencyProxy);
  readonly profile = signal<CompanyProfileResponse | null>(null);
  readonly profileSaving = signal(false);
  readonly logoUploading = signal(false);
  displayName = '';
  taxPin = '';
  vatNumber = '';
  currency: string | null = null;
  currencyDisplay = '';

  // Two-factor mandate.
  readonly twoFactorLoading = signal(true);
  readonly twoFactorSaving = signal(false);
  readonly requireTwoFactor = signal(false);

  // Audit retention.
  readonly retention = signal<RetentionResponse | null>(null);
  readonly retentionSaving = signal(false);
  /** Bound to the input; empty string means "use the system default". */
  retentionDays: number | null = null;

  constructor() {
    this.auth.tenant_profile_get().subscribe({
      next: (res) => this.applyProfile(res),
      error: () => this.notify.error('Could not load the company information'),
    });
    this.auth.tenant_two_factor_get().subscribe({
      next: (res) => {
        this.requireTwoFactor.set(res.require_two_factor);
        this.twoFactorLoading.set(false);
      },
      error: () => this.twoFactorLoading.set(false),
    });
    this.audit.get_retention().subscribe({
      next: (res) => {
        this.retention.set(res);
        this.retentionDays = res.retention_days ?? null;
      },
      error: () => this.notify.error('Could not load the audit retention settings'),
    });
  }

  private applyProfile(res: CompanyProfileResponse): void {
    this.profile.set(res);
    this.displayName = res.display_name;
    this.taxPin = res.tax_pin ?? '';
    this.vatNumber = res.vat_number ?? '';
    this.currency = res.default_currency ?? null;
    this.currencyDisplay = res.default_currency ?? '';
    // Upgrade the bare code to "CODE — Name" once the list is at hand.
    if (res.default_currency) {
      this.currencyProxy.list_currencies().subscribe({
        next: (all) => {
          const row = all.find((c) => c.code === this.currency);
          if (row) this.currencyDisplay = `${row.code} — ${row.name}`;
        },
        error: () => {},
      });
    }
  }

  /** The logo lives on the API origin; the SPA runs on another. */
  logoSrc(profile: CompanyProfileResponse): string | null {
    return profile.logo_url ? environment.apiBaseUrl + profile.logo_url : null;
  }

  saveProfile(): void {
    if (this.profileSaving()) return;
    if (!this.displayName.trim()) {
      this.notify.error('The company name must not be empty.');
      return;
    }
    this.profileSaving.set(true);
    this.auth
      .tenant_profile_update({
        display_name: this.displayName.trim(),
        default_currency: this.currency ?? undefined,
        tax_pin: this.taxPin.trim() || undefined,
        vat_number: this.vatNumber.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.profileSaving.set(false);
          this.applyProfile(res);
          this.notify.success('Company information updated');
        },
        error: (err: unknown) => {
          this.profileSaving.set(false);
          this.notify.error(apiErrorInfo(err).message || 'Could not update the company information');
        },
      });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.logoUploading()) return;
    if (file.size > 1024 * 1024) {
      this.notify.error('The logo must be at most 1 MiB.');
      return;
    }
    this.logoUploading.set(true);
    this.auth.tenant_logo_upload({ data: file, fileName: file.name }).subscribe({
      next: (res) => {
        this.logoUploading.set(false);
        this.applyProfile(res);
        this.notify.success('Logo updated');
      },
      error: (err: unknown) => {
        this.logoUploading.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not upload the logo');
      },
    });
  }

  async toggleTwoFactor(): Promise<void> {
    if (this.twoFactorSaving()) return;
    const enable = !this.requireTwoFactor();
    if (enable) {
      const ok = await this.confirm.ask({
        title: 'Mandate two-factor authentication?',
        message:
          'Every user without an authenticator will be required to enroll at their next sign-in.',
        confirmText: 'Mandate 2FA',
      });
      if (!ok) return;
    }
    this.twoFactorSaving.set(true);
    this.auth.tenant_two_factor({ required: enable }).subscribe({
      next: (res) => {
        this.twoFactorSaving.set(false);
        this.requireTwoFactor.set(res.require_two_factor);
        this.notify.success(
          res.require_two_factor
            ? 'Two-factor authentication is now mandatory'
            : 'Two-factor authentication is now optional',
        );
      },
      error: (err: unknown) => {
        this.twoFactorSaving.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not update the policy');
      },
    });
  }

  saveRetention(): void {
    if (this.retentionSaving()) return;
    const days = this.retentionDays;
    const max = this.retention()?.max_days ?? 0;
    if (days !== null && (days < 1 || (max > 0 && days > max))) {
      this.notify.error(`Retention must be between 1 and ${max} days (empty for the default).`);
      return;
    }
    this.retentionSaving.set(true);
    this.audit.set_retention({ retention_days: days ?? undefined }).subscribe({
      next: (res) => {
        this.retentionSaving.set(false);
        this.retention.set(res);
        this.retentionDays = res.retention_days ?? null;
        this.notify.success('Audit retention updated');
      },
      error: (err: unknown) => {
        this.retentionSaving.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not update the retention');
      },
    });
  }
}
