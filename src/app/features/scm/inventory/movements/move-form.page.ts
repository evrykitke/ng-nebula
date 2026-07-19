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
import { asDate } from '../../../../shared/forms/dates';
import { fieldText } from '../../../../shared/forms/numeric';
import { asDateString } from '../../shared/scm-format';
import { itemLookup, warehouseLookup } from '../../shared/scm-lookups';
import {
  CreateMoveRequest,
  InventoryItem,
  InventoryServiceProxy,
  MoveLineRequest,
  MoveType,
  MoveView,
} from '../../../../shared/service-proxies/service-proxies';

interface MoveLine {
  item_id: string;
  item_label: string;
  track_batches: boolean;
  track_serials: boolean;
  qty: string;
  unit_cost: string;
  batch_no: string;
  serial_nos: string;
  memo: string;
}

const TYPE_META: Record<MoveType, { title: string; subtitle: string; needsCost: boolean }> = {
  receipt: {
    title: 'New receipt',
    subtitle: 'Bring stock into a warehouse — each line carries its unit cost',
    needsCost: true,
  },
  issue: {
    title: 'New issue',
    subtitle: 'Take stock out of a warehouse at its running average cost',
    needsCost: false,
  },
  transfer: {
    title: 'New transfer',
    subtitle: 'Move stock from one warehouse to another',
    needsCost: false,
  },
  adjustment: {
    title: 'New adjustment',
    subtitle: 'Reconcile a warehouse to counted quantities',
    needsCost: false,
  },
};

/**
 * Compose a stock movement of a given type and optionally post it. The
 * warehouse fields and per-line cost adapt to the type: receipts take a
 * destination and require costs, issues take a source, transfers take both,
 * adjustments count a single warehouse. Also serves as the draft editor.
 */
@Component({
  selector: 'app-move-form-page',
  imports: [FormsModule, RouterLink, NgIcon, UiButton, UiDatepicker, Lookup, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './move-form.page.html',
})
export class MoveFormPage {
  private readonly proxy = inject(InventoryServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly canPost = computed(() => this.auth.hasPermission(Permissions.movementsPost));

  readonly editId = signal<string | null>(null);
  readonly moveType = signal<MoveType>('receipt');
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly meta = computed(() => TYPE_META[this.moveType()]);
  readonly needsFrom = computed(() => this.moveType() !== 'receipt');
  readonly needsTo = computed(
    () => this.moveType() === 'receipt' || this.moveType() === 'transfer',
  );
  readonly needsCost = computed(() => this.meta().needsCost);
  // Adjustments may also carry a cost: required by the backend when counting
  // an item up from zero stock (no average to inherit), optional otherwise.
  readonly showCost = computed(() => this.needsCost() || this.moveType() === 'adjustment');

  readonly itemLookup = itemLookup(this.proxy, (i) => i.item_type !== 'service');
  readonly warehouseLookup = warehouseLookup(this.proxy);

  form = {
    entry_date: DateTime.now() as DateTime | undefined,
    from_warehouse_id: '',
    from_warehouse_label: '',
    to_warehouse_id: '',
    to_warehouse_label: '',
    reference: '',
    memo: '',
  };

  readonly lines = signal<MoveLine[]>([this.blankLine()]);

  readonly title = computed(() => (this.editId() ? 'Edit movement' : this.meta().title));

  constructor() {
    const editId = this.route.snapshot.paramMap.get('id');
    const type = this.route.snapshot.paramMap.get('type') as MoveType | null;
    this.editId.set(editId);
    if (type && TYPE_META[type]) this.moveType.set(type);
    if (editId) this.loadDraft(editId);
  }

  private loadDraft(id: string): void {
    this.proxy.get_move(id).subscribe({
      next: (m: MoveView) => {
        if (m.status !== 'draft') {
          this.notify.error('Only a draft can be edited');
          void this.router.navigate(['/inventory/movements', id]);
          return;
        }
        this.moveType.set(m.move_type);
        this.form = {
          entry_date: asDate(m.entry_date),
          from_warehouse_id: m.from_warehouse?.id ?? '',
          from_warehouse_label: m.from_warehouse
            ? `${m.from_warehouse.code} — ${m.from_warehouse.name}`
            : '',
          to_warehouse_id: m.to_warehouse?.id ?? '',
          to_warehouse_label: m.to_warehouse
            ? `${m.to_warehouse.code} — ${m.to_warehouse.name}`
            : '',
          reference: m.reference ?? '',
          memo: m.memo ?? '',
        };
        this.lines.set(
          m.lines.map((l) => ({
            item_id: l.item_id,
            item_label: `${l.sku} — ${l.item_name}`,
            track_batches: !!l.batch_no,
            track_serials: l.serial_nos.length > 0,
            qty: String(Number(l.qty)),
            unit_cost: l.unit_cost ? String(Number(l.unit_cost)) : '',
            batch_no: l.batch_no ?? '',
            serial_nos: l.serial_nos.join(', '),
            memo: l.memo ?? '',
          })),
        );
      },
      error: (err) => {
        this.notify.error('Could not load the draft', apiErrorInfo(err).message);
        void this.router.navigate(['/inventory/movements']);
      },
    });
  }

  private blankLine(): MoveLine {
    return {
      item_id: '',
      item_label: '',
      track_batches: false,
      track_serials: false,
      qty: '',
      unit_cost: '',
      batch_no: '',
      serial_nos: '',
      memo: '',
    };
  }

  addLine(): void {
    this.lines.update((ls) => [...ls, this.blankLine()]);
  }

  removeLine(i: number): void {
    this.lines.update((ls) => ls.filter((_, idx) => idx !== i));
  }

  onItemSelected(line: MoveLine, item: InventoryItem): void {
    line.item_id = item.id;
    line.item_label = `${item.sku} — ${item.name}`;
    line.track_batches = item.track_batches;
    line.track_serials = item.track_serials;
    this.lines.update((ls) => [...ls]);
  }

  onItemValue(line: MoveLine, value: string | null): void {
    line.item_id = value ?? '';
    if (!value) {
      line.item_label = '';
      line.track_batches = false;
      line.track_serials = false;
    }
    this.lines.update((ls) => [...ls]);
  }

  saveDraft(): void {
    this.submit(false);
  }

  savePost(): void {
    this.submit(true);
  }

  private submit(post: boolean): void {
    if (this.saving()) return;
    const body = this.build();
    if (!body) return;

    this.saving.set(true);
    const editId = this.editId();
    const save$ = editId ? this.proxy.update_move(editId, body) : this.proxy.create_move(body);
    const flow$ = post
      ? save$.pipe(switchMap((v: MoveView) => this.proxy.post_move(v.id)))
      : save$;
    flow$.subscribe({
      next: (v) => {
        this.saving.set(false);
        this.notify.success(post ? 'Movement posted' : 'Draft saved');
        void this.router.navigate(['/inventory/movements', v.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(apiErrorInfo(err).message || 'Could not save the movement.');
      },
    });
  }

  private build(): CreateMoveRequest | null {
    this.formError.set(null);
    const date = this.form.entry_date;
    if (!date || !date.isValid) {
      this.formError.set('A valid date is required.');
      return null;
    }
    if (this.needsFrom() && !this.form.from_warehouse_id) {
      this.formError.set('A source warehouse is required.');
      return null;
    }
    if (this.needsTo() && !this.form.to_warehouse_id) {
      this.formError.set('A destination warehouse is required.');
      return null;
    }
    if (
      this.moveType() === 'transfer' &&
      this.form.from_warehouse_id === this.form.to_warehouse_id
    ) {
      this.formError.set('Transfers need different source and destination warehouses.');
      return null;
    }
    if (!this.form.memo.trim()) {
      this.formError.set('A memo describing the movement is required.');
      return null;
    }

    const lines: MoveLineRequest[] = [];
    for (const l of this.lines()) {
      if (!l.item_id && !l.qty) continue;
      if (!l.item_id) {
        this.formError.set('Every line needs an item.');
        return null;
      }
      const qty = Number(l.qty);
      if (!(qty >= 0) || (this.moveType() !== 'adjustment' && qty <= 0)) {
        this.formError.set('Each line needs a valid quantity.');
        return null;
      }
      if (this.needsCost() && !(Number(l.unit_cost) >= 0 && fieldText(l.unit_cost) !== '')) {
        this.formError.set('Receipts require a unit cost on every line.');
        return null;
      }
      if (fieldText(l.unit_cost) !== '' && !(Number(l.unit_cost) >= 0)) {
        this.formError.set('A unit cost must be zero or more.');
        return null;
      }
      if (l.track_batches && !l.batch_no.trim()) {
        this.formError.set('A batch-tracked item needs a batch number.');
        return null;
      }
      const serials = l.serial_nos
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (l.track_serials && serials.length === 0) {
        this.formError.set('A serial-tracked item needs its serial numbers.');
        return null;
      }
      lines.push({
        item_id: l.item_id,
        qty: qty.toString(),
        unit_cost: this.showCost() && fieldText(l.unit_cost) ? Number(l.unit_cost).toString() : undefined,
        batch_no: l.track_batches ? l.batch_no.trim() : undefined,
        serial_nos: l.track_serials ? serials : undefined,
        memo: l.memo.trim() || undefined,
      });
    }
    if (lines.length === 0) {
      this.formError.set('Add at least one line.');
      return null;
    }

    return {
      move_type: this.moveType(),
      entry_date: asDateString(date),
      from_warehouse_id: this.needsFrom() ? this.form.from_warehouse_id : undefined,
      to_warehouse_id: this.needsTo() ? this.form.to_warehouse_id : undefined,
      reference: this.form.reference.trim() || undefined,
      memo: this.form.memo.trim(),
      lines,
    };
  }
}
