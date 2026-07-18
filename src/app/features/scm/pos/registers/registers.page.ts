import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon } from '@ng-icons/core';
import { map } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button';
import { Modal } from '../../../../shared/ui/modal';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { DataTable } from '../../../../shared/datatable/data-table';
import { TableConfig, TableDataSource, col } from '../../../../shared/datatable/table-config';
import { clientSideSource } from '../../../../shared/datatable/client-side';
import { Lookup } from '../../../../shared/lookup/lookup';
import { customerLookup, priceListLookup, warehouseLookup } from '../../shared/scm-lookups';
import {
  InventoryServiceProxy,
  PosRegister,
  PosServiceProxy,
  RegisterBody,
  SalesServiceProxy,
} from '../../../../shared/service-proxies/service-proxies';

/**
 * The registers: each one a physical counter bound to a warehouse, a price
 * list and a walk-in buyer. Created rarely, so a modal form does — the till
 * itself only ever picks from this list.
 */
@Component({
  selector: 'app-pos-registers-page',
  imports: [FormsModule, NgIcon, UiButton, Modal, PageHeader, DataTable, Lookup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './registers.page.html',
})
export class RegistersPage {
  private readonly proxy = inject(PosServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  readonly canManage = computed(() => this.auth.hasPermission(Permissions.posRegistersManage));

  readonly warehouses = warehouseLookup(inject(InventoryServiceProxy));
  readonly priceLists = priceListLookup(inject(SalesServiceProxy));
  readonly customers = customerLookup(inject(SalesServiceProxy));

  private readonly table = viewChild<DataTable<PosRegister>>(DataTable);

  readonly tableConfig = computed<TableConfig<PosRegister>>(() => ({
    id: 'pos-registers',
    rowKey: (r) => r.id,
    columns: [
      col.text<PosRegister>('code', 'Code').sortable().width('120px'),
      col.text<PosRegister>('name', 'Name').sortable(),
      col
        .badge<PosRegister>('is_active', 'Status')
        .value((r) => (r.is_active ? 'active' : 'inactive'))
        .badgeColors({ active: 'success', inactive: 'muted' }),
      col
        .text<PosRegister>('allow_negative_stock_sales', 'Offline overshoot')
        .value((r) => (r.allow_negative_stock_sales ? 'allowed' : 'blocked at close')),
    ],
    defaultSort: 'code',
    pageSize: 25,
    search: true,
    searchPlaceholder: 'Search code or name…',
    actions: this.canManage() ? [{ key: 'edit', label: 'Edit' }] : [],
    emptyText: 'No registers yet — create the first counter.',
  }));

  readonly dataSource: TableDataSource<PosRegister> = clientSideSource(
    () => this.proxy.list_registers().pipe(map((rows) => rows ?? [])),
    (r, term) => r.code.toLowerCase().includes(term) || r.name.toLowerCase().includes(term),
  );

  // --- modal form ---
  readonly formOpen = signal(false);
  readonly busy = signal(false);
  editing: PosRegister | null = null;
  form = this.emptyForm();
  warehouseLabel = '';
  priceListLabel = '';
  customerLabel = '';

  private emptyForm() {
    return {
      code: '',
      name: '',
      warehouse_id: null as string | null,
      price_list_id: null as string | null,
      default_customer_id: null as string | null,
      receipt_header: '',
      receipt_footer: '',
      allow_negative_stock_sales: false,
      is_active: true,
    };
  }

  openCreate(): void {
    this.editing = null;
    this.form = this.emptyForm();
    this.warehouseLabel = this.priceListLabel = this.customerLabel = '';
    this.formOpen.set(true);
  }

  openEdit(r: PosRegister): void {
    this.editing = r;
    this.form = {
      code: r.code,
      name: r.name,
      warehouse_id: r.warehouse_id,
      price_list_id: r.price_list_id ?? null,
      default_customer_id: r.default_customer_id ?? null,
      receipt_header: r.receipt_header ?? '',
      receipt_footer: r.receipt_footer ?? '',
      allow_negative_stock_sales: r.allow_negative_stock_sales,
      is_active: r.is_active,
    };
    // The lookups fetch their own display text lazily; seed with the ids so
    // an untouched field round-trips unchanged.
    this.warehouseLabel = this.priceListLabel = this.customerLabel = '';
    this.formOpen.set(true);
  }

  onAction(event: { key: string; row: PosRegister }): void {
    if (event.key === 'edit') this.openEdit(event.row);
  }

  save(): void {
    if (this.busy()) return;
    if (!this.form.code.trim() || !this.form.name.trim() || !this.form.warehouse_id) {
      this.notify.error('Code, name and warehouse are required.');
      return;
    }
    const body: RegisterBody = {
      code: this.form.code.trim(),
      name: this.form.name.trim(),
      warehouse_id: this.form.warehouse_id,
      price_list_id: this.form.price_list_id ?? undefined,
      default_customer_id: this.form.default_customer_id ?? undefined,
      receipt_header: this.form.receipt_header.trim() || undefined,
      receipt_footer: this.form.receipt_footer.trim() || undefined,
      allow_negative_stock_sales: this.form.allow_negative_stock_sales,
      is_active: this.form.is_active,
    };
    this.busy.set(true);
    const call = this.editing
      ? this.proxy.update_register(this.editing.id, body)
      : this.proxy.create_register(body);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.formOpen.set(false);
        this.table()?.reload();
        this.notify.success(this.editing ? 'Register updated' : 'Register created');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify.error(apiErrorInfo(err).message || 'Could not save the register.');
      },
    });
  }
}
