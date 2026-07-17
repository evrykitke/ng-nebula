import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../shared/ui/button';
import { Skeleton } from '../../../shared/ui/skeleton';
import { PageHeader } from '../../../core/layout/page-header/page-header';
import { AuthService } from '../../../core/auth/auth.service';
import { Permissions } from '../../../core/auth/permissions.constants';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../core/services/confirm.service';
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
  RoleResponse,
} from '../../../shared/service-proxies/service-proxies';

/** A group checkbox's derived state over its leaf permissions. */
type CheckState = 'all' | 'some' | 'none';

/**
 * Roles & permissions: a two-pane manager. The left lists roles; the right
 * edits the selected role's display name and permission set as a searchable,
 * collapsible tree. Only leaf permissions are stored on the role — group
 * checkboxes are derived (checked / indeterminate) and cascade to the subtree.
 * Static roles (Admin) implicitly hold everything and are not editable.
 */
@Component({
  selector: 'app-roles-page',
  imports: [FormsModule, NgIcon, UiButton, Skeleton, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './roles.page.html',
})
export class RolesPage {
  private readonly proxy = inject(AuthServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  readonly roles = signal<RoleResponse[]>([]);
  /** Root permission nodes (the module forest). */
  readonly tree = signal<PermTreeNode[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly selected = signal<RoleResponse | null>(null);
  readonly editing = signal(false);
  /** The chosen leaf permission names of the role being edited. */
  private readonly chosen = signal<Set<string>>(new Set());

  /** Permission search text; a non-empty query overrides collapse state. */
  readonly query = signal('');
  /** Names of expanded branch nodes (ignored while searching). */
  private readonly expanded = signal<Set<string>>(new Set());

  /** Rows to render: the filtered tree, fully expanded while searching. */
  readonly visible = computed(() => {
    const q = this.query().trim();
    const roots = q ? filterTree(this.tree(), q) : this.tree();
    return q
      ? visibleNodes(roots, () => true)
      : visibleNodes(roots, (n) => this.expanded().has(n));
  });

  readonly totalLeaves = computed(() => leafNames(this.tree()).length);
  readonly chosenCount = computed(() => this.chosen().size);
  /** Static roles implicitly hold everything; their tree is read-only. */
  readonly isStatic = computed(() => this.selected()?.is_static ?? false);

  name = '';
  displayName = '';

  readonly canCreate = computed(() => this.auth.hasPermission(Permissions.rolesCreate));
  readonly canEdit = computed(() => this.auth.hasPermission(Permissions.rolesEdit));
  readonly canDelete = computed(() => this.auth.hasPermission(Permissions.rolesDelete));

  constructor() {
    this.loadRoles();
    this.proxy.permission_tree().subscribe({
      next: (defs) => {
        const roots = buildPermissionTree(defs);
        this.tree.set(roots);
        // Start with the top-level modules open so the tree isn't a wall.
        this.expanded.set(new Set(roots.filter((n) => n.children.length).map((n) => n.name)));
      },
      error: () => this.notify.error('Failed to load permissions'),
    });
  }

  private loadRoles(): void {
    this.loading.set(true);
    this.proxy.list_roles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Failed to load roles');
      },
    });
  }

  select(role: RoleResponse): void {
    this.selected.set(role);
    this.name = role.name;
    this.displayName = role.display_name;
    this.chosen.set(new Set(role.permissions));
    this.editing.set(true);
  }

  newRole(): void {
    this.selected.set(null);
    this.name = '';
    this.displayName = '';
    this.chosen.set(new Set());
    this.editing.set(true);
  }

  // ---- tree expansion ----

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

  // ---- selection ----

  /** The leaf permissions under a node (the node itself when it is a leaf). */
  private leavesOf(node: PermTreeNode): string[] {
    return node.children.length ? leafNames(node.children) : [node.name];
  }

  stateOf(node: PermTreeNode): CheckState {
    const leaves = this.leavesOf(node);
    const set = this.chosen();
    const count = leaves.filter((l) => set.has(l)).length;
    if (count === 0) return 'none';
    return count === leaves.length ? 'all' : 'some';
  }

  chosenIn(node: PermTreeNode): number {
    const set = this.chosen();
    return this.leavesOf(node).filter((l) => set.has(l)).length;
  }

  leavesIn(node: PermTreeNode): number {
    return this.leavesOf(node).length;
  }

  /** Cascade: (un)checking a node applies to every leaf underneath it. */
  toggleNode(node: PermTreeNode, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.chosen());
    for (const leaf of this.leavesOf(node)) {
      if (checked) next.add(leaf);
      else next.delete(leaf);
    }
    this.chosen.set(next);
  }

  // ---- persistence ----

  save(): void {
    if (this.saving()) return;
    if (!this.displayName.trim()) {
      this.notify.error('Display name is required');
      return;
    }
    const role = this.selected();
    if (!role && !this.name.trim()) {
      this.notify.error('Role name is required');
      return;
    }
    this.saving.set(true);
    // Persist leaf permissions only; group names are a UI grouping. Filtering
    // through the known leaves also sheds stale names from older saves.
    const known = new Set(leafNames(this.tree()));
    const permissions = [...this.chosen()].filter((p) => known.size === 0 || known.has(p));

    const done = {
      next: (saved: RoleResponse) => {
        this.saving.set(false);
        this.notify.success('Role saved');
        this.loadRoles();
        this.select(saved);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not save the role');
      },
    };

    if (role) {
      this.proxy
        .update_role(role.id, { display_name: this.displayName.trim(), permissions })
        .subscribe(done);
    } else {
      this.proxy
        .create_role({
          name: this.name.trim(),
          display_name: this.displayName.trim(),
          permissions,
        })
        .subscribe(done);
    }
  }

  async remove(): Promise<void> {
    const role = this.selected();
    if (!role) return;
    const ok = await this.confirm.ask({
      title: `Delete role “${role.display_name}”?`,
      message: 'Users assigned only this role will lose its permissions.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.proxy.delete_role(role.id).subscribe({
      next: () => {
        this.notify.success('Role deleted');
        this.editing.set(false);
        this.selected.set(null);
        this.loadRoles();
      },
      error: (err: unknown) =>
        this.notify.error(apiErrorInfo(err).message || 'Could not delete the role'),
    });
  }
}
