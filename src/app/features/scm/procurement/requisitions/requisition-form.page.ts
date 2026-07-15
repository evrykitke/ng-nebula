import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { DateTime } from 'luxon';
import { switchMap } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button';
import { UiDatepicker } from '../../../../shared/ui/datepicker';
import { Lookup } from '../../../../shared/lookup/lookup';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { asDateString } from '../../shared/scm-format';
import { itemLookup, warehouseLookup } from '../../shared/scm-lookups';
import {
  CreateRequisitionRequest,
  InventoryItem,
  InventoryServiceProxy,
  ProcurementServiceProxy,
  RequisitionLineRequest,
  RequisitionView,
} from '../../../../shared/service-proxies/service-proxies';

interface ReqLine {
  item_id: string;
  item_label: string;
  qty: string;
  memo: string;
}

/** Compose or edit a draft requisition, optionally submitting it in one step. */
@Component({
  selector: 'app-requisition-form-page',
  imports: [FormsModule, RouterLink, NgIcon, UiButton, UiDatepicker, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './requisition-form.page.html',
})
export class RequisitionFormPage {
  private readonly proxy = inject(ProcurementServiceProxy);
  private readonly inventory = inject(InventoryServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly canSubmit = computed(() => this.auth.hasPermission(Permissions.requisitionsSubmit));

  readonly editId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly itemLookup = itemLookup(this.inventory, (i) => i.is_purchasable);
  readonly warehouseLookup = warehouseLookup(this.inventory);

  form = {
    warehouse_id: '',
    warehouse_label: '',
    needed_by: undefined as DateTime | undefined,
    memo: '',
  };

  readonly lines = signal<ReqLine[]>([this.blank()]);

  readonly title = computed(() => (this.editId() ? 'Edit requisition' : 'New requisition'));

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.editId.set(id);
    if (id) this.loadDraft(id);
  }

  private loadDraft(id: string): void {
    this.proxy.get_requisition(id).subscribe({
      next: (r: RequisitionView) => {
        if (r.status !== 'draft') {
          this.notify.error('Only a draft can be edited');
          void this.router.navigate(['/procurement/requisitions', id]);
          return;
        }
        this.form = {
          warehouse_id: r.warehouse_id,
          warehouse_label: r.warehouse_code,
          needed_by: r.needed_by,
          memo: r.memo ?? '',
        };
        this.lines.set(
          r.lines.map((l) => ({
            item_id: l.item_id,
            item_label: `${l.sku} — ${l.item_name}`,
            qty: String(Number(l.qty)),
            memo: l.memo ?? '',
          })),
        );
      },
      error: (err) => {
        this.notify.error('Could not load the draft', apiErrorInfo(err).message);
        void this.router.navigate(['/procurement/requisitions']);
      },
    });
  }

  private blank(): ReqLine {
    return { item_id: '', item_label: '', qty: '', memo: '' };
  }

  addLine(): void {
    this.lines.update((ls) => [...ls, this.blank()]);
  }

  removeLine(i: number): void {
    this.lines.update((ls) => ls.filter((_, idx) => idx !== i));
  }

  onItemSelected(line: ReqLine, item: InventoryItem): void {
    line.item_id = item.id;
    line.item_label = `${item.sku} — ${item.name}`;
  }

  onItemValue(line: ReqLine, value: string | null): void {
    line.item_id = value ?? '';
    if (!value) line.item_label = '';
  }

  saveDraft(): void {
    this.submit(false);
  }

  saveSubmit(): void {
    this.submit(true);
  }

  private submit(send: boolean): void {
    if (this.saving()) return;
    const body = this.build();
    if (!body) return;

    this.saving.set(true);
    const editId = this.editId();
    const save$ = editId
      ? this.proxy.update_requisition(editId, body)
      : this.proxy.create_requisition(body);
    const flow$ = send
      ? save$.pipe(switchMap((r: RequisitionView) => this.proxy.submit_requisition(r.id)))
      : save$;
    flow$.subscribe({
      next: (r) => {
        this.saving.set(false);
        this.notify.success(send ? 'Requisition submitted' : 'Draft saved');
        void this.router.navigate(['/procurement/requisitions', r.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the requisition.');
      },
    });
  }

  private build(): CreateRequisitionRequest | null {
    this.formError.set(null);
    if (!this.form.warehouse_id) {
      this.formError.set('A warehouse is required.');
      return null;
    }
    const lines: RequisitionLineRequest[] = [];
    for (const l of this.lines()) {
      if (!l.item_id && !l.qty) continue;
      if (!l.item_id) {
        this.formError.set('Every line needs an item.');
        return null;
      }
      const qty = Number(l.qty);
      if (!(qty > 0)) {
        this.formError.set('Each line needs a positive quantity.');
        return null;
      }
      lines.push({ item_id: l.item_id, qty: qty.toString(), memo: l.memo.trim() || undefined });
    }
    if (lines.length === 0) {
      this.formError.set('Add at least one line.');
      return null;
    }
    return {
      warehouse_id: this.form.warehouse_id,
      needed_by: this.form.needed_by ? asDateString(this.form.needed_by) : undefined,
      memo: this.form.memo.trim() || undefined,
      lines,
    };
  }
}
