import { ChangeDetectionStrategy, Component, computed, model, viewChild } from '@angular/core';
import { DateTime } from 'luxon';
import {
  BrnCalendar,
  BrnCalendarCell,
  BrnCalendarCellButton,
  BrnCalendarGrid,
  BrnCalendarHeader,
  BrnCalendarNextButton,
  BrnCalendarPreviousButton,
  BrnCalendarWeek,
  BrnCalendarWeekday,
} from '@spartan-ng/brain/calendar';
import { injectDateAdapter } from '@spartan-ng/brain/date-time';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight } from '@ng-icons/lucide';

/** Themed calendar built on Spartan's headless brnCalendar (luxon dates). */
@Component({
  selector: 'app-calendar',
  imports: [
    BrnCalendar,
    BrnCalendarGrid,
    BrnCalendarWeek,
    BrnCalendarWeekday,
    BrnCalendarCell,
    BrnCalendarCellButton,
    BrnCalendarHeader,
    BrnCalendarPreviousButton,
    BrnCalendarNextButton,
    NgIcon,
  ],
  providers: [provideIcons({ lucideChevronLeft, lucideChevronRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div brnCalendar [(date)]="date" [weekStartsOn]="1" class="w-fit select-none p-3 text-sm">
      <div class="mb-2 flex items-center justify-between">
        <button
          brnCalendarPreviousButton
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground
                 transition-colors hover:bg-accent"
        >
          <ng-icon name="lucideChevronLeft" size="16" />
        </button>
        <!-- Month + year quick navigation (jump anywhere without paging) -->
        <div brnCalendarHeader class="flex items-center gap-1">
          <select
            (change)="setMonth($any($event.target).value)"
            aria-label="Month"
            class="h-7 pl-2 pr-7 text-sm font-medium"
          >
            @for (m of months; track $index) {
              <option [value]="$index + 1" [selected]="$index + 1 === focusedMonth()">
                {{ m }}
              </option>
            }
          </select>
          <select
            (change)="setYear($any($event.target).value)"
            aria-label="Year"
            class="h-7 pl-2 pr-7 text-sm font-medium"
          >
            @for (y of years(); track y) {
              <option [value]="y" [selected]="y === focusedYear()">{{ y }}</option>
            }
          </select>
        </div>
        <button
          brnCalendarNextButton
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground
                 transition-colors hover:bg-accent"
        >
          <ng-icon name="lucideChevronRight" size="16" />
        </button>
      </div>

      <table brnCalendarGrid class="w-full border-collapse">
        <thead>
          <tr class="flex">
            <th
              *brnCalendarWeekday="let weekday"
              scope="col"
              class="flex h-8 w-9 items-center justify-center text-xs font-normal text-muted-foreground"
            >
              {{ dow(weekday) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr *brnCalendarWeek="let week" class="mt-0.5 flex">
            @for (day of week; track da.getTime(day)) {
              <td brnCalendarCell class="p-0">
                <button
                  brnCalendarCellButton
                  [date]="day"
                  class="flex h-9 w-9 items-center justify-center rounded-md text-sm text-foreground
                         outline-none transition-colors hover:bg-accent
                         focus-visible:ring-2 focus-visible:ring-ring
                         data-[outside]:text-muted-foreground/40
                         data-[today]:font-semibold data-[today]:text-primary
                         data-[selected-single]:bg-primary data-[selected-single]:font-medium
                         data-[selected-single]:text-primary-foreground
                         data-[disabled]:pointer-events-none data-[disabled]:opacity-30"
                >
                  {{ da.getDate(day) }}
                </button>
              </td>
            }
          </tr>
        </tbody>
      </table>
    </div>
  `,
})
export class UiCalendar {
  private static readonly DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  protected dow(index: number): string {
    return UiCalendar.DOW[index] ?? '';
  }

  protected readonly da = injectDateAdapter<DateTime>();
  readonly date = model<DateTime | undefined>();

  private readonly cal = viewChild(BrnCalendar);

  /** The currently displayed page (tracks navigation). */
  private readonly focused = computed(
    () => (this.cal()?.focusedDate() as DateTime | undefined) ?? DateTime.now(),
  );
  protected readonly focusedMonth = computed(() => this.focused().month);
  protected readonly focusedYear = computed(() => this.focused().year);

  /** Month names for the header select. */
  protected readonly months = Array.from({ length: 12 }, (_, i) =>
    DateTime.local(2000, i + 1, 1).toFormat('LLLL'),
  );

  /** Selectable years: a decade ahead back to a century ago, newest first. */
  protected readonly years = computed(() => {
    const now = DateTime.now().year;
    // Include the focused year even if the selection sits outside the range.
    const top = Math.max(now + 10, this.focusedYear());
    const bottom = Math.min(now - 100, this.focusedYear());
    return Array.from({ length: top - bottom + 1 }, (_, i) => top - i);
  });

  protected setMonth(month: string | number): void {
    this.jump({ month: Number(month) });
  }

  protected setYear(year: string | number): void {
    this.jump({ year: Number(year) });
  }

  private jump(parts: { month?: number; year?: number }): void {
    const cal = this.cal();
    if (!cal) return;
    cal.setFocusedDate(this.focused().set(parts));
  }
}
