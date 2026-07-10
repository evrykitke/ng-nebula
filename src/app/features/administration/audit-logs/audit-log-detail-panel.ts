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
import {
  AuditLog,
  AuditServiceProxy,
  FieldChange,
} from '../../../shared/service-proxies/service-proxies';

/**
 * The audit table's expandable row detail: the request context alongside the
 * recorded change set, fetched lazily when the row is expanded. Entity rows
 * (create/update/delete) carry a diff; request/event rows only context. The
 * full entry page stays one click away for the timeline view.
 */
@Component({
  selector: 'app-audit-log-detail-panel',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-x-8 gap-y-4 py-1 lg:grid-cols-2">
      <dl class="text-sm">
        @if (entry().message) {
          <div class="flex justify-between gap-4 border-b border-border/50 py-1">
            <dt class="shrink-0 text-muted-foreground">Message</dt>
            <dd class="text-right">{{ entry().message }}</dd>
          </div>
        }
        <div class="flex justify-between gap-4 border-b border-border/50 py-1">
          <dt class="text-muted-foreground">Request</dt>
          <dd class="truncate font-mono text-xs">{{ entry().method }} {{ entry().path }}</dd>
        </div>
        <div class="flex justify-between gap-4 border-b border-border/50 py-1">
          <dt class="text-muted-foreground">Status</dt>
          <dd class="font-medium">
            {{ entry().status_code ?? '—' }}
            <span class="text-muted-foreground">· {{ entry().duration_ms ?? '—' }} ms</span>
          </dd>
        </div>
        <div class="flex justify-between gap-4 border-b border-border/50 py-1">
          <dt class="text-muted-foreground">IP address</dt>
          <dd class="font-mono text-xs">{{ entry().ip_address || '—' }}</dd>
        </div>
        <div class="flex justify-between gap-4 border-b border-border/50 py-1">
          <dt class="text-muted-foreground">Request id</dt>
          <dd class="truncate font-mono text-xs">{{ entry().request_id || '—' }}</dd>
        </div>
        <div class="flex justify-between gap-4 py-1">
          <dt class="shrink-0 text-muted-foreground">User agent</dt>
          <dd class="truncate text-xs">{{ entry().user_agent || '—' }}</dd>
        </div>
      </dl>

      <div>
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {{ isDiff() ? 'Before → After' : 'Change set' }}
        </h3>
        @if (loading()) {
          <p class="text-sm text-muted-foreground">Loading changes…</p>
        } @else if (changes().length === 0) {
          <p class="text-sm text-muted-foreground">
            No field-level changes were recorded for this entry.
          </p>
        } @else {
          <div class="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
            @for (c of changes(); track c.field) {
              <div>
                <p class="mb-0.5 text-xs font-medium text-foreground">{{ c.field }}</p>
                @if (isDiff()) {
                  <div class="flex flex-col gap-1 sm:flex-row sm:items-center">
                    <code class="flex-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs text-destructive line-through break-all">{{ before(c) }}</code>
                    <span class="text-muted-foreground">→</span>
                    <code class="flex-1 rounded-md bg-green-500/10 px-2 py-0.5 text-xs text-green-700 dark:text-green-300 break-all">{{ after(c) }}</code>
                  </div>
                } @else {
                  <code class="block rounded-md bg-muted px-2 py-0.5 text-xs break-all">{{ snapshot(c) }}</code>
                }
              </div>
            }
          </div>
        }
        <a
          [routerLink]="['/administration/audit-logs', entry().id]"
          class="mt-3 inline-block text-sm text-primary hover:underline"
        >
          Open full entry →
        </a>
      </div>
    </div>
  `,
})
export class AuditLogDetailPanel {
  private readonly proxy = inject(AuditServiceProxy);

  readonly entry = input.required<AuditLog>();

  readonly changes = signal<FieldChange[]>([]);
  readonly loading = signal(false);

  readonly isDiff = computed(() => this.entry().action === 'update');

  constructor() {
    // Fetch the diff once per expansion; only entity rows carry snapshots.
    effect(() => {
      const e = this.entry();
      if (!['create', 'update', 'delete'].includes(e.action)) return;
      this.loading.set(true);
      this.proxy.get_log_diff(e.id).subscribe({
        next: (diff) => {
          this.changes.set(diff.changes);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
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
    return this.entry().action === 'delete' ? this.before(change) : this.after(change);
  }

  private render(value: unknown): string {
    if (value === null || value === undefined) return '—';
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
}
