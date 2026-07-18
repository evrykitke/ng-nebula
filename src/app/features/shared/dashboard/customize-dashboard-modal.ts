import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChartColumn,
  lucideCheck,
  lucideGauge,
  lucideList,
  lucideRotateCcw,
  lucideSquareActivity,
  lucideTable,
} from '@ng-icons/lucide';
import { Modal } from '../../../shared/ui/modal';
import { UiButton } from '../../../shared/ui/button';
import { Skeleton } from '../../../shared/ui/skeleton';
import { NotificationService } from '../../../core/services/notification.service';
import { apiErrorInfo } from '../../../shared/api/api-error';
import {
  DashboardServiceProxy,
  PlacedWidget,
  PlacedWidgetView,
  WidgetInfo,
  WidgetKind,
} from '../../../shared/service-proxies/service-proxies';

const KIND_ICON: Record<WidgetKind, string> = {
  stat: 'lucideSquareActivity',
  chart: 'lucideChartColumn',
  table: 'lucideTable',
  list: 'lucideList',
  progress: 'lucideGauge',
};

const KIND_LABEL: Record<WidgetKind, string> = {
  stat: 'Stat',
  chart: 'Chart',
  table: 'Table',
  list: 'List',
  progress: 'Progress',
};

/**
 * The customize popup behind the canvas's upper-right button: every widget
 * this dashboard offers *and this user is permitted to see* (the server
 * filters the catalogue), each toggleable onto or off the canvas.
 *
 * Selection respects the canvas cap — at `maxWidgets` the remaining
 * entries grey out rather than letting a save fail. Saving keeps the
 * arrangement of tiles that stay and appends newcomers at the end with
 * their natural span; the footer also offers the way back to the default
 * layout.
 */
@Component({
  selector: 'app-customize-dashboard-modal',
  imports: [Modal, NgIcon, UiButton, Skeleton],
  providers: [
    provideIcons({
      lucideChartColumn,
      lucideCheck,
      lucideGauge,
      lucideList,
      lucideRotateCcw,
      lucideSquareActivity,
      lucideTable,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customize-dashboard-modal.html',
})
export class CustomizeDashboardModal {
  private readonly proxy = inject(DashboardServiceProxy);
  private readonly notify = inject(NotificationService);

  readonly open = input.required<boolean>();
  readonly dashboard = input.required<string>();
  readonly maxWidgets = input(12);
  /** What is on the canvas now — order and spans survive a save. */
  readonly placed = input.required<PlacedWidgetView[]>();

  readonly closed = output<void>();
  readonly saved = output<PlacedWidget[]>();
  readonly reset = output<void>();

  readonly catalogue = signal<WidgetInfo[] | null>(null);
  private readonly selection = signal<Set<string>>(new Set());

  readonly full = computed(() => this.selection().size >= this.maxWidgets());
  readonly counter = computed(
    () => `${this.selection().size} of ${this.maxWidgets()} widgets on the canvas`,
  );

  constructor() {
    // Re-seed the selection from the canvas each time the modal opens, and
    // fetch the catalogue on the first open only.
    effect(() => {
      if (!this.open()) return;
      this.selection.set(new Set(this.placed().map((p) => p.name)));
      if (this.catalogue() === null) this.load();
    });
  }

  private load(): void {
    this.proxy.dashboard_widgets(this.dashboard()).subscribe({
      next: (list) => this.catalogue.set(list),
      error: (err) => {
        this.notify.error('Could not load the widget catalogue', apiErrorInfo(err).message);
        this.closed.emit();
      },
    });
  }

  picked(name: string): boolean {
    return this.selection().has(name);
  }

  toggle(name: string): void {
    this.selection.update((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else if (next.size < this.maxWidgets()) next.add(name);
      return next;
    });
  }

  save(): void {
    const chosen = this.selection();
    const kept: PlacedWidget[] = this.placed()
      .filter((p) => chosen.has(p.name))
      .map((p) => ({ widget: p.name, span: p.span }));
    const existing = new Set(kept.map((p) => p.widget));
    const added: PlacedWidget[] = (this.catalogue() ?? [])
      .filter((w) => chosen.has(w.name) && !existing.has(w.name))
      .map((w) => ({ widget: w.name, span: w.default_span }));
    this.saved.emit([...kept, ...added]);
  }

  protected kindIcon(kind: WidgetKind): string {
    return KIND_ICON[kind];
  }
  protected kindLabel(kind: WidgetKind): string {
    return KIND_LABEL[kind];
  }
}
