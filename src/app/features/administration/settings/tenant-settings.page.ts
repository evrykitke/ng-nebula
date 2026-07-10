import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '../../../shared/ui/button';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { apiErrorInfo } from '../../../shared/api/api-error';
import {
  AuditServiceProxy,
  AuthServiceProxy,
  RetentionResponse,
} from '../../../shared/service-proxies/service-proxies';

/**
 * Tenant Settings — the workspace-wide policies a tenant admin controls:
 * the company 2FA mandate, the audit-trail retention override, and the
 * on-demand tenant database migration (how a tenant picks up newly deployed
 * features without waiting for a restart).
 */
@Component({
  selector: 'app-tenant-settings-page',
  imports: [FormsModule, UiButton, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tenant-settings.page.html',
})
export class TenantSettingsPage {
  private readonly auth = inject(AuthServiceProxy);
  private readonly audit = inject(AuditServiceProxy);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  // Two-factor mandate.
  readonly twoFactorLoading = signal(true);
  readonly twoFactorSaving = signal(false);
  readonly requireTwoFactor = signal(false);

  // Audit retention.
  readonly retention = signal<RetentionResponse | null>(null);
  readonly retentionSaving = signal(false);
  /** Bound to the input; empty string means "use the system default". */
  retentionDays: number | null = null;

  // Migration.
  readonly migrating = signal(false);

  constructor() {
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

  migrate(): void {
    if (this.migrating()) return;
    this.migrating.set(true);
    this.auth.tenant_migrate().subscribe({
      next: (res) => {
        this.migrating.set(false);
        this.notify.success('Migration queued', `Task ${res.task_id} is running in the background.`);
      },
      error: (err: unknown) => {
        this.migrating.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not queue the migration');
      },
    });
  }
}
