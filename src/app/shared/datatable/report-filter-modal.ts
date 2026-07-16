import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '../ui/button';
import { Modal } from '../ui/modal';
import { Criterion, FilterFieldView, emptyCriterion, isActive, summarize } from './report-filter';

/**
 * The criteria form shown before a list prints: which rows belong on the paper.
 *
 * The fields are handed in already derived from the list's columns, so this
 * component only renders them and collects what the user typed. Leaving it
 * untouched and pressing Export prints everything, which is what the button
 * did before this modal existed.
 */
@Component({
  selector: 'app-report-filter-modal',
  standalone: true,
  imports: [FormsModule, Modal, UiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" size="lg" title="Export PDF" (closed)="cancel.emit()">
      <p class="mb-4 text-sm text-muted-foreground">
        Narrow what goes on the document. Anything left blank is not filtered, and
        the screen is unaffected.
      </p>

      <div class="flex flex-col gap-4">
        @for (f of fields(); track f.field) {
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_1fr] sm:items-start">
            <label class="pt-1.5 text-sm font-medium text-foreground">{{ f.label }}</label>

            @switch (f.kind) {
              @case ('choice') {
                <div class="flex flex-wrap gap-x-4 gap-y-1.5">
                  @for (o of f.options; track o) {
                    <label class="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        [checked]="isChosen(f.field, o)"
                        (change)="toggleChoice(f.field, o)"
                      />
                      {{ o }}
                    </label>
                  }
                </div>
              }
              @case ('dateRange') {
                <div class="flex items-center gap-2">
                  <input
                    type="date"
                    class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    [ngModel]="value(f.field).from"
                    (ngModelChange)="patch(f.field, { from: $event })"
                  />
                  <span class="text-sm text-muted-foreground">to</span>
                  <input
                    type="date"
                    class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    [ngModel]="value(f.field).to"
                    (ngModelChange)="patch(f.field, { to: $event })"
                  />
                </div>
              }
              @case ('numberRange') {
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    [ngModel]="value(f.field).min"
                    (ngModelChange)="patch(f.field, { min: $event })"
                  />
                  <span class="text-sm text-muted-foreground">to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    [ngModel]="value(f.field).max"
                    (ngModelChange)="patch(f.field, { max: $event })"
                  />
                </div>
              }
              @default {
                <input
                  type="text"
                  placeholder="Contains…"
                  class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  [ngModel]="value(f.field).contains"
                  (ngModelChange)="patch(f.field, { contains: $event })"
                />
              }
            }
          </div>
        } @empty {
          <p class="text-sm text-muted-foreground">This list has nothing to filter by.</p>
        }
      </div>

      <div modalFooter class="flex items-center justify-between gap-3">
        <span class="text-xs text-muted-foreground">{{ summaryText() }}</span>
        <div class="flex gap-2">
          <button uiBtn variant="ghost" [disabled]="!anyActive()" (click)="reset()">Clear</button>
          <button uiBtn variant="outline" (click)="cancel.emit()">Cancel</button>
          <button uiBtn (click)="apply.emit(values())">Export</button>
        </div>
      </div>
    </app-modal>
  `,
})
export class ReportFilterModal {
  readonly open = input(false);
  readonly fields = input<FilterFieldView[]>([]);

  readonly apply = output<Record<string, Criterion>>();
  readonly cancel = output<void>();

  /** What the user has typed, keyed by column field. */
  readonly values = signal<Record<string, Criterion>>({});

  readonly anyActive = computed(() => Object.values(this.values()).some(isActive));

  /** The criteria in words — the same phrasing the document will carry. */
  readonly summaryText = computed(() => {
    const bits = summarize(this.fields(), this.values());
    return bits.length ? bits.join(' · ') : 'No filters — the whole list';
  });

  value(field: string): Criterion {
    return this.values()[field] ?? emptyCriterion();
  }

  patch(field: string, part: Partial<Criterion>): void {
    this.values.update((v) => ({ ...v, [field]: { ...this.value(field), ...part } }));
  }

  isChosen(field: string, option: string): boolean {
    return this.value(field).chosen.includes(option);
  }

  toggleChoice(field: string, option: string): void {
    const chosen = this.value(field).chosen;
    this.patch(field, {
      chosen: chosen.includes(option) ? chosen.filter((c) => c !== option) : [...chosen, option],
    });
  }

  reset(): void {
    this.values.set({});
  }
}
