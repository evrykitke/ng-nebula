import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ClassValue } from 'clsx';
import { cn } from '../utils/cn';

/**
 * A single shimmer block. `<app-skeleton class="h-4 w-32" />`
 *
 * Sized by the caller, because only the caller knows what is arriving. The
 * shimmer itself — colour, radius, cadence — is decided here so a skeleton
 * never reads as a different material from one page to the next.
 */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: { '[class]': 'cls()' },
})
export class Skeleton {
  readonly userClass = input<ClassValue>('', { alias: 'class' });
  protected readonly cls = computed(() => cn('block animate-pulse rounded-md bg-muted', this.userClass()));
}

/**
 * An indeterminate spinner, for waits too short or too shapeless to draw a
 * skeleton for — a button mid-submit, a lookup fetching its options.
 *
 * Prefer a skeleton whenever the shape of what is coming is known: it holds
 * the layout still, where a spinner lets it jump on arrival.
 */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="animate-spin"
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        class="opacity-90"
      />
    </svg>
  `,
  host: {
    class: 'inline-flex items-center justify-center text-current',
    role: 'status',
    '[attr.aria-label]': 'label()',
  },
})
export class Spinner {
  readonly size = input(16);
  readonly label = input('Loading');
}

type PageSkeletonVariant = 'detail' | 'table' | 'form' | 'cards' | 'report';

/**
 * The page-level wait: the silhouette of the page that is about to land.
 *
 * Every page that fetches before it can paint used to print "Loading…" and
 * then jump to full content. These variants trace the four layouts this app
 * actually uses, so the wait occupies roughly the space the answer will.
 *
 * - `detail`  — a header card of fields over a lines table (order, invoice, item…)
 * - `table`   — the lines table alone (list pages, report tabs)
 * - `form`    — stacked label/control rows (settings panels, new-document pages)
 * - `cards`   — a grid of equal panels (dashboards, report tiles)
 * - `report`  — side-by-side statement columns (balance sheet, trial balance)
 */
@Component({
  selector: 'app-page-skeleton',
  imports: [Skeleton, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', role: 'status', 'aria-label': 'Loading', 'aria-busy': 'true' },
  template: `
    @switch (variant()) {
      @case ('form') {
        <div class="rounded-lg border border-border bg-card p-4">
          @for (row of rowsArr(); track $index) {
            <div class="mb-4 last:mb-0">
              <app-skeleton class="mb-2 h-3 w-24" />
              <app-skeleton class="h-9 w-full max-w-md" />
            </div>
          }
        </div>
      }
      @case ('cards') {
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (card of rowsArr(); track $index) {
            <div class="rounded-lg border border-border bg-card p-4">
              <app-skeleton class="h-3 w-20" />
              <app-skeleton class="mt-3 h-7 w-32" />
              <app-skeleton class="mt-2 h-3 w-24" />
            </div>
          }
        </div>
      }
      @case ('report') {
        <div class="grid gap-4 lg:grid-cols-2">
          @for (col of [0, 1]; track col) {
            <section class="rounded-lg border border-border bg-card">
              <div class="border-b border-border px-4 py-2.5">
                <app-skeleton class="h-4 w-32" />
              </div>
              <div class="p-4">
                @for (line of rowsArr(); track $index) {
                  <div class="flex items-center justify-between gap-4 py-1.5">
                    <app-skeleton class="h-3 flex-1 max-w-64" />
                    <app-skeleton class="h-3 w-20" />
                  </div>
                }
              </div>
            </section>
          }
        </div>
      }
      @case ('table') {
        <ng-container [ngTemplateOutlet]="linesTable" />
      }
      @default {
        <!-- Header card: the four-ish summary fields nearly every detail page opens with. -->
        <div class="mb-4 rounded-lg border border-border bg-card p-4">
          <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
            @for (field of [0, 1, 2, 3]; track field) {
              <div>
                <app-skeleton class="h-3 w-16" />
                <app-skeleton class="mt-2 h-4 w-24" />
              </div>
            }
          </div>
        </div>
        <ng-container [ngTemplateOutlet]="linesTable" />
      }
    }

    <ng-template #linesTable>
      <div class="overflow-hidden rounded-lg border border-border bg-card">
        <div class="border-b border-border px-4 py-2.5">
          <app-skeleton class="h-4 w-28" />
        </div>
        @for (line of rowsArr(); track $index) {
          <div class="flex items-center gap-4 border-b border-border/40 px-4 py-2.5 last:border-0">
            <app-skeleton class="h-4 flex-1" />
            <app-skeleton class="h-4 w-16" />
            <app-skeleton class="h-4 w-20" />
            <app-skeleton class="h-4 w-24" />
          </div>
        }
      </div>
    </ng-template>
  `,
})
export class PageSkeleton {
  readonly variant = input<PageSkeletonVariant>('detail');
  /** How many repeating units (lines, fields, cards) to trace. */
  readonly rows = input(5);
  protected readonly rowsArr = computed(() => Array.from({ length: this.rows() }));
}
