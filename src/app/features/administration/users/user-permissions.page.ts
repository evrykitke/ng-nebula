import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  effect,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../shared/ui/button';
import { PageSkeleton } from '../../../shared/ui/skeleton';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../core/services/notification.service';
import {
  PermTreeNode,
  branchNames,
  buildPermissionTree,
  filterTree,
  leafNames,
  visibleNodes,
} from '../../../core/auth/permission-tree';
import { apiErrorInfo } from '../../../shared/api/api-error';
import {
  AuthServiceProxy,
  Profile,
  RoleResponse,
  UserPermissionsResponse,
} from '../../../shared/service-proxies/service-proxies';

/** A leaf's override against what the user's roles grant. */
type Override = 'inherit' | 'grant' | 'deny';

/**
 * Per-user access management: the user's roles (unioned to a base permission
 * set) and per-permission overrides — grants beyond the roles, and denies
 * that win over everything. Mirrors the backend's resolution: roles union,
 * overrides applied, deny wins.
 */
@Component({
  selector: 'app-user-permissions-page',
  imports: [PageSkeleton, FormsModule, NgIcon, RouterLink, UiButton, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-permissions.page.html',
})
export class UserPermissionsPage {
  private readonly proxy = inject(AuthServiceProxy);
  private readonly notify = inject(NotificationService);

  /** Route parameter (component input binding). */
  readonly id = input.required<string>();
  private readonly userId = computed(() => this.id());

  readonly user = signal<Profile | null>(null);
  readonly allRoles = signal<RoleResponse[]>([]);
  readonly tree = signal<PermTreeNode[]>([]);
  readonly loading = signal(true);
  readonly savingRoles = signal(false);
  readonly savingOverrides = signal(false);

  /** Ids of the roles currently assigned (edited by the checkboxes). */
  readonly assignedRoles = signal<Set<string>>(new Set());
  /** Per-permission overrides being edited. */
  private readonly grants = signal<Set<string>>(new Set());
  private readonly denies = signal<Set<string>>(new Set());
  /** The server-resolved effective permission names (after the last save). */
  readonly effective = signal<Set<string>>(new Set());

  readonly query = signal('');
  private readonly expanded = signal<Set<string>>(new Set());

  readonly visible = computed(() => {
    const q = this.query().trim();
    const roots = q ? filterTree(this.tree(), q) : this.tree();
    return q
      ? visibleNodes(roots, () => true)
      : visibleNodes(roots, (n) => this.expanded().has(n));
  });

  readonly effectiveCount = computed(() => this.effective().size);
  readonly totalLeaves = computed(() => leafNames(this.tree()).length);
  readonly displayName = computed(() => {
    const u = this.user();
    return u ? `${u.first_name} ${u.last_name}`.trim() || u.user_name : `#${this.id()}`;
  });

  constructor() {
    this.proxy.permission_tree().subscribe({
      next: (defs) => {
        const roots = buildPermissionTree(defs);
        this.tree.set(roots);
        this.expanded.set(new Set(roots.filter((n) => n.children.length).map((n) => n.name)));
      },
      error: () => this.notify.error('Failed to load permissions'),
    });
    this.proxy.list_roles().subscribe({
      next: (roles) => this.allRoles.set(roles),
      error: () => this.notify.error('Failed to load roles'),
    });
    // The route id is an input signal; (re)load whenever it resolves.
    effect(() => {
      const id = this.userId();
      if (id) this.load(id);
    });
  }

  private load(id: string): void {
    this.loading.set(true);
    this.proxy.user_permissions(id).subscribe({
      next: (res) => {
        this.apply(res);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Failed to load user access');
      },
    });
    this.proxy.list_users().subscribe({
      next: (users) => this.user.set(users.find((u) => u.id === id) ?? null),
      error: () => {},
    });
  }

  private apply(res: UserPermissionsResponse): void {
    this.assignedRoles.set(new Set(res.roles.map((r) => r.id)));
    this.grants.set(new Set(res.granted));
    this.denies.set(new Set(res.denied));
    this.effective.set(new Set(res.effective));
  }

  // ---- roles ----

  hasRole(role: RoleResponse): boolean {
    return this.assignedRoles().has(role.id);
  }

  toggleRole(role: RoleResponse): void {
    const next = new Set(this.assignedRoles());
    if (next.has(role.id)) next.delete(role.id);
    else next.add(role.id);
    this.assignedRoles.set(next);
  }

  saveRoles(): void {
    if (this.savingRoles()) return;
    this.savingRoles.set(true);
    this.proxy.set_user_roles(this.userId(), { role_ids: [...this.assignedRoles()] }).subscribe({
      next: () => {
        this.savingRoles.set(false);
        this.notify.success('Roles updated');
        // Effective permissions changed with the roles; re-resolve.
        this.load(this.userId());
      },
      error: (err: unknown) => {
        this.savingRoles.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not update roles');
      },
    });
  }

  // ---- tree ----

  isExpanded(name: string): boolean {
    return this.expanded().has(name);
  }

  toggleExpand(name: string): void {
    const next = new Set(this.expanded());
    if (next.has(name)) next.delete(name);
    else next.add(name);
    this.expanded.set(next);
  }

  expandAll(): void {
    this.expanded.set(new Set(branchNames(this.tree())));
  }

  collapseAll(): void {
    this.expanded.set(new Set());
  }

  // ---- overrides ----

  overrideOf(name: string): Override {
    if (this.denies().has(name)) return 'deny';
    if (this.grants().has(name)) return 'grant';
    return 'inherit';
  }

  setOverride(name: string, override: Override): void {
    const grants = new Set(this.grants());
    const denies = new Set(this.denies());
    grants.delete(name);
    denies.delete(name);
    if (override === 'grant') grants.add(name);
    if (override === 'deny') denies.add(name);
    this.grants.set(grants);
    this.denies.set(denies);
  }

  isEffective(name: string): boolean {
    return this.effective().has(name);
  }

  saveOverrides(): void {
    if (this.savingOverrides()) return;
    this.savingOverrides.set(true);
    this.proxy
      .set_user_permissions(this.userId(), {
        granted: [...this.grants()],
        denied: [...this.denies()],
      })
      .subscribe({
        next: (res) => {
          this.savingOverrides.set(false);
          this.apply(res);
          this.notify.success('Overrides saved');
        },
        error: (err: unknown) => {
          this.savingOverrides.set(false);
          this.notify.error(apiErrorInfo(err).message || 'Could not save the overrides');
        },
      });
  }
}
