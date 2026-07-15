import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { DateTime } from 'luxon';
import { UiButton } from '../../../../shared/ui/button';
import { UiDatepicker } from '../../../../shared/ui/datepicker';
import { Lookup } from '../../../../shared/lookup/lookup';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { asDateString } from '../../shared/scm-format';
import { itemLookup, supplierLookup } from '../../shared/scm-lookups';
import {
  CreateRfqRequest,
  InventoryItem,
  InventoryServiceProxy,
  ProcurementServiceProxy,
  ProcurementSupplier,
  RfqLineRequest,
  RfqView,
} from '../../../../shared/service-proxies/service-proxies';

interface RfqLine {
  item_id: string;
  item_label: string;
  qty: string;
  memo: string;
}

interface InvitedSupplier {
  id: string;
  label: string;
}

/**
 * Compose or edit a draft RFQ: a title, the items to quote, and the
 * suppliers to invite. Suppliers can also be added later on the detail page.
 */
@Component({
  selector: 'app-rfq-form-page',
  imports: [FormsModule, RouterLink, NgIcon, UiButton, UiDatepicker, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rfq-form.page.html',
})
export class RfqFormPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly inventory = inject(InventoryServiceProxy);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly editId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly itemLookup = itemLookup(this.inventory, (i) => i.is_purchasable);
  readonly supplierLookup = supplierLookup(this.proxy, (s) => s.is_active);

  form = {
    title: '',
    due_date: undefined as DateTime | undefined,
    memo: '',
  };

  readonly lines = signal<RfqLine[]>([this.blank()]);
  readonly suppliers = signal<InvitedSupplier[]>([]);
  pickSupplierId = '';
  pickSupplierLabel = '';

  readonly title = computed(() => (this.editId() ? 'Edit RFQ' : 'New RFQ'));

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.editId.set(id);
    if (id) this.loadDraft(id);
  }

  private loadDraft(id: string): void {
    this.proxy.get_rfq(id).subscribe({
      next: (r: RfqView) => {
        if (r.status !== 'draft') {
          this.notify.error('Only a draft can be edited');
          void this.router.navigate(['/procurement/rfqs', id]);
          return;
        }
        this.form = { title: r.title, due_date: r.due_date, memo: r.memo ?? '' };
        this.lines.set(
          r.lines.map((l) => ({
            item_id: l.item_id,
            item_label: `${l.sku} — ${l.item_name}`,
            qty: String(Number(l.qty)),
            memo: l.memo ?? '',
          })),
        );
        this.suppliers.set(
          r.suppliers.map((s) => ({ id: s.supplier_id, label: `${s.code} — ${s.name}` })),
        );
      },
      error: (err) => {
        this.notify.error('Could not load the draft', apiErrorInfo(err).message);
        void this.router.navigate(['/procurement/rfqs']);
      },
    });
  }

  private blank(): RfqLine {
    return { item_id: '', item_label: '', qty: '', memo: '' };
  }

  addLine(): void {
    this.lines.update((ls) => [...ls, this.blank()]);
  }

  removeLine(i: number): void {
    this.lines.update((ls) => ls.filter((_, idx) => idx !== i));
  }

  onItemSelected(line: RfqLine, item: InventoryItem): void {
    line.item_id = item.id;
    line.item_label = `${item.sku} — ${item.name}`;
  }

  onItemValue(line: RfqLine, value: string | null): void {
    line.item_id = value ?? '';
    if (!value) line.item_label = '';
  }

  onSupplierPicked(s: ProcurementSupplier): void {
    this.pickSupplierId = s.id;
    this.pickSupplierLabel = `${s.code} — ${s.name}`;
  }

  addSupplier(): void {
    if (!this.pickSupplierId) return;
    if (this.suppliers().some((s) => s.id === this.pickSupplierId)) return;
    this.suppliers.update((ss) => [...ss, { id: this.pickSupplierId, label: this.pickSupplierLabel }]);
    this.pickSupplierId = '';
    this.pickSupplierLabel = '';
  }

  removeSupplier(id: string): void {
    this.suppliers.update((ss) => ss.filter((s) => s.id !== id));
  }

  save(): void {
    if (this.saving()) return;
    this.formError.set(null);
    if (!this.form.title.trim()) return this.formError.set('A title is required.');

    const lines: RfqLineRequest[] = [];
    for (const l of this.lines()) {
      if (!l.item_id && !l.qty) continue;
      if (!l.item_id) return this.formError.set('Every line needs an item.');
      const qty = Number(l.qty);
      if (!(qty > 0)) return this.formError.set('Each line needs a positive quantity.');
      lines.push({ item_id: l.item_id, qty: qty.toString(), memo: l.memo.trim() || undefined });
    }
    if (lines.length === 0) return this.formError.set('Add at least one line.');

    const body: CreateRfqRequest = {
      title: this.form.title.trim(),
      due_date: this.form.due_date ? asDateString(this.form.due_date) : undefined,
      memo: this.form.memo.trim() || undefined,
      lines,
      supplier_ids: this.suppliers().map((s) => s.id),
    };

    this.saving.set(true);
    const editId = this.editId();
    const save$ = editId ? this.proxy.update_rfq(editId, body) : this.proxy.create_rfq(body);
    save$.subscribe({
      next: (r) => {
        this.saving.set(false);
        this.notify.success(editId ? 'RFQ updated' : 'RFQ created');
        void this.router.navigate(['/procurement/rfqs', r.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the RFQ.');
      },
    });
  }
}
