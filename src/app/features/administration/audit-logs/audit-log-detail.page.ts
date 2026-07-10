import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../core/services/notification.service';
import { apiErrorInfo } from '../../../shared/api/api-error';
import { emptyChangesText } from './audit-log-detail-panel';
import {
  AuditLog,
  AuditServiceProxy,
  FieldChange,
} from '../../../shared/service-proxies/service-proxies';

/**
 * One audit entry: the full request context (who, from where, how long) and
 * the what-changed view — the server-computed field-level diff between the
 * before/after snapshots.
 */
@Component({
  selector: 'app-audit-log-detail-page',
  imports: [RouterLink, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-log-detail.page.html',
})
export class AuditLogDetailPage {
  private readonly proxy = inject(AuditServiceProxy);
  private readonly notify = inject(NotificationService);

  /** Route parameter (component input binding). */
  readonly id = input.required<string>();

  readonly entry = signal<AuditLog | null>(null);
  readonly changes = signal<FieldChange[]>([]);
  readonly loading = signal(true);
  /** Why the entry could not be shown (404 vs. server unreachable). */
  readonly loadError = signal<string | null>(null);

  /** Update rows show before → after; create/delete a single snapshot side. */
  readonly isDiff = computed(() => this.entry()?.action === 'update');
  readonly emptyText = computed(() => emptyChangesText(this.entry()?.action ?? ''));

  readonly when = computed(() => {
    const at = this.entry()?.created_at;
    return at ? at.toFormat('yyyy-LL-dd HH:mm:ss') : '';
  });

  constructor() {
    effect(() => {
      const id = Number(this.id());
      if (Number.isFinite(id)) this.load(id);
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.proxy.get_log(id).subscribe({
      next: (entry) => {
        this.entry.set(entry);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        const info = apiErrorInfo(err);
        this.loadError.set(
          info.status === 404
            ? 'This audit entry does not exist (it may have been pruned by retention).'
            : info.message || 'The audit entry could not be loaded.',
        );
        this.entry.set(null);
        this.loading.set(false);
      },
    });
    this.proxy.get_log_diff(id).subscribe({
      next: (diff) => this.changes.set(diff.changes),
      error: () => this.notify.error('Could not load the change set'),
    });
  }

  /* `new` is a keyword in template expressions, so the FieldChange sides are
     read here instead of in the template. */
  before(change: FieldChange): string {
    return this.render(change['old']);
  }

  after(change: FieldChange): string {
    return this.render(change['new']);
  }

  /** The populated side for snapshot rows: before for deletes, after otherwise. */
  snapshot(change: FieldChange): string {
    return this.entry()?.action === 'delete' ? this.before(change) : this.after(change);
  }

  private render(value: unknown): string {
    if (value === null || value === undefined) return '—';
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
}
