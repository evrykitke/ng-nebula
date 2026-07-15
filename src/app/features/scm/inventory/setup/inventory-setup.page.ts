import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { Modal } from '../../../../shared/ui/modal';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import {
  CategoryBody,
  InventoryCategory,
  InventoryServiceProxy,
  InventoryUom,
  UomBody,
} from '../../../../shared/service-proxies/service-proxies';

/**
 * Inventory setup: the two reference registers items depend on —
 * categories (with optional GL role overrides) and units of measure.
 * Both are small enough to manage side by side through modals.
 */
@Component({
  selector: 'app-inventory-setup-page',
  imports: [FormsModule, NgIcon, UiButton, Modal, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventory-setup.page.html',
})
export class InventorySetupPage {
  private readonly proxy = inject(InventoryServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  readonly canManage = computed(() => this.auth.hasPermission(Permissions.itemsCreate));

  readonly categories = signal<InventoryCategory[]>([]);
  readonly uoms = signal<InventoryUom[]>([]);

  // --- category modal ---
  readonly categoryModal = signal(false);
  readonly categoryEditId = signal<string | null>(null);
  readonly categorySaving = signal(false);
  readonly categoryError = signal<string | null>(null);
  categoryForm = { name: '', code: '', parent_id: '', description: '', is_active: true };

  // --- uom modal ---
  readonly uomModal = signal(false);
  readonly uomSaving = signal(false);
  readonly uomError = signal<string | null>(null);
  uomForm = { code: '', name: '', symbol: '', fractional: false };

  constructor() {
    this.reloadCategories();
    this.reloadUoms();
  }

  private reloadCategories(): void {
    this.proxy.list_categories().subscribe({
      next: (all) => this.categories.set(all ?? []),
      error: (err) => this.notify.error('Could not load categories', apiErrorInfo(err).message),
    });
  }

  private reloadUoms(): void {
    this.proxy.list_uoms().subscribe({
      next: (all) => this.uoms.set(all ?? []),
      error: (err) => this.notify.error('Could not load units', apiErrorInfo(err).message),
    });
  }

  categoryName(id: string | undefined): string {
    return id ? (this.categories().find((c) => c.id === id)?.name ?? '—') : '—';
  }

  /** Parents offered in the modal: everything except the edited node itself. */
  readonly parentChoices = computed(() =>
    this.categories().filter((c) => c.id !== this.categoryEditId()),
  );

  openNewCategory(): void {
    this.categoryEditId.set(null);
    this.categoryForm = { name: '', code: '', parent_id: '', description: '', is_active: true };
    this.categoryError.set(null);
    this.categoryModal.set(true);
  }

  openEditCategory(c: InventoryCategory): void {
    this.categoryEditId.set(c.id);
    this.categoryForm = {
      name: c.name,
      code: c.code ?? '',
      parent_id: c.parent_id ?? '',
      description: c.description ?? '',
      is_active: c.is_active,
    };
    this.categoryError.set(null);
    this.categoryModal.set(true);
  }

  saveCategory(): void {
    if (this.categorySaving()) return;
    this.categoryError.set(null);
    if (!this.categoryForm.name.trim()) return this.categoryError.set('Name is required.');

    const body: CategoryBody = {
      name: this.categoryForm.name.trim(),
      code: this.categoryForm.code.trim() || undefined,
      parent_id: this.categoryForm.parent_id || undefined,
      description: this.categoryForm.description.trim() || undefined,
      is_active: this.categoryForm.is_active,
    };
    this.categorySaving.set(true);
    const editId = this.categoryEditId();
    const save$ = editId
      ? this.proxy.update_category(editId, body)
      : this.proxy.create_category(body);
    save$.subscribe({
      next: () => {
        this.categorySaving.set(false);
        this.categoryModal.set(false);
        this.notify.success(editId ? 'Category updated' : 'Category created');
        this.reloadCategories();
      },
      error: (err) => {
        this.categorySaving.set(false);
        this.categoryError.set(apiErrorInfo(err).message || 'Could not save the category.');
      },
    });
  }

  async removeCategory(c: InventoryCategory): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Delete ${c.name}?`,
      message: 'A category still referenced by items or children cannot be deleted.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.proxy.delete_category(c.id).subscribe({
      next: () => {
        this.notify.success('Category deleted');
        this.reloadCategories();
      },
      error: (err) => this.notify.error(apiErrorInfo(err).message || 'Delete failed'),
    });
  }

  openNewUom(): void {
    this.uomForm = { code: '', name: '', symbol: '', fractional: false };
    this.uomError.set(null);
    this.uomModal.set(true);
  }

  saveUom(): void {
    if (this.uomSaving()) return;
    this.uomError.set(null);
    if (!this.uomForm.code.trim()) return this.uomError.set('Code is required.');
    if (!this.uomForm.name.trim()) return this.uomError.set('Name is required.');

    const body: UomBody = {
      code: this.uomForm.code.trim(),
      name: this.uomForm.name.trim(),
      symbol: this.uomForm.symbol.trim() || undefined,
      fractional: this.uomForm.fractional,
    };
    this.uomSaving.set(true);
    this.proxy.create_uom(body).subscribe({
      next: () => {
        this.uomSaving.set(false);
        this.uomModal.set(false);
        this.notify.success('Unit created');
        this.reloadUoms();
      },
      error: (err) => {
        this.uomSaving.set(false);
        this.uomError.set(apiErrorInfo(err).message || 'Could not create the unit.');
      },
    });
  }
}
