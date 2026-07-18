import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLayoutDashboard, lucideSettings2 } from '@ng-icons/lucide';
import { UiButton } from '../../../shared/ui/button';
import { PageSkeleton } from '../../../shared/ui/skeleton';
import { NotificationService } from '../../../core/services/notification.service';
import { apiErrorInfo } from '../../../shared/api/api-error';
import {
  DashboardServiceProxy,
  DashboardView,
  PlacedWidget,
  PlacedWidgetView,
} from '../../../shared/service-proxies/service-proxies';
import { DashboardWidget } from './dashboard-widget';
import { CustomizeDashboardModal } from './customize-dashboard-modal';

/*
 * Tile widths live in a static map rather than string interpolation:
 * Tailwind only generates classes it can see in the source, and
 * `lg:col-span-${n}` is invisible to it. On phones everything stacks; on
 * small screens a tile takes half or all of a six-column grid; from `lg`
 * up the canvas is the real twelve-column playing field.
 */
const LG_SPAN: Record<number, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  10: 'lg:col-span-10',
  11: 'lg:col-span-11',
  12: 'lg:col-span-12',
};

/**
 * The playing field: a module's dashboard as a 12-column grid of widgets.
 *
 * The canvas asks the server for placement only — names, titles, kinds,
 * spans — and each tile then fetches its own data lazily as it becomes
 * visible. Tiles drag to rearrange (HTML5 drag and drop, reordering
 * locally on hover and saving once on drop), and the Customize modal adds
 * and removes widgets within the server's cap. Every change is persisted
 * per user per dashboard; Reset returns to the module's default layout.
 *
 * Pages embed it and wire their header's Customize button to
 * `openCustomize()` via a template reference.
 */
@Component({
  selector: 'app-dashboard-canvas',
  imports: [NgIcon, UiButton, PageSkeleton, DashboardWidget, CustomizeDashboardModal],
  providers: [provideIcons({ lucideLayoutDashboard, lucideSettings2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-canvas.html',
})
export class DashboardCanvas {
  private readonly proxy = inject(DashboardServiceProxy);
  private readonly notify = inject(NotificationService);

  /** The canvas name the backend knows: "workspace", "accounting", "pos"… */
  readonly dashboard = input.required<string>();

  readonly view = signal<DashboardView | null>(null);
  readonly loading = signal(true);
  readonly customizing = signal(false);

  private dragIndex: number | null = null;
  private dragMoved = false;

  readonly canCustomize = computed(() => this.view() !== null);

  constructor() {
    effect(() => {
      const name = this.dashboard();
      this.load(name);
    });
  }

  private load(name: string): void {
    this.loading.set(true);
    this.proxy.get_dashboard(name).subscribe({
      next: (v) => {
        this.view.set(v);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load the dashboard', apiErrorInfo(err).message);
      },
    });
  }

  openCustomize(): void {
    if (this.view()) this.customizing.set(true);
  }

  protected tileClass(w: PlacedWidgetView): string {
    const sm = w.span <= 3 ? 'sm:col-span-3' : 'sm:col-span-6';
    const lg = LG_SPAN[Math.min(Math.max(w.span, 1), 12)];
    return `col-span-1 ${sm} ${lg} transition-opacity`;
  }

  // --- Drag to rearrange --------------------------------------------------
  // The order of the array *is* the layout; dragging just moves an entry
  // as the pointer passes other tiles, then one PUT persists the result.

  protected onDragStart(index: number, event: DragEvent): void {
    this.dragIndex = index;
    this.dragMoved = false;
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected onDragEnter(index: number): void {
    const from = this.dragIndex;
    if (from === null || from === index) return;
    const v = this.view();
    if (!v) return;
    const widgets = [...v.widgets];
    const [moved] = widgets.splice(from, 1);
    widgets.splice(index, 0, moved);
    this.view.set({ ...v, widgets });
    this.dragIndex = index;
    this.dragMoved = true;
  }

  protected onDragEnd(): void {
    if (this.dragMoved) {
      const v = this.view();
      if (v) this.persist(v.widgets.map((w) => ({ widget: w.name, span: w.span })));
    }
    this.dragIndex = null;
    this.dragMoved = false;
  }

  // --- Customize / reset --------------------------------------------------

  protected onCustomized(widgets: PlacedWidget[]): void {
    this.customizing.set(false);
    this.persist(widgets);
  }

  protected onReset(): void {
    this.customizing.set(false);
    this.proxy.reset_dashboard(this.dashboard()).subscribe({
      next: (v) => this.view.set(v),
      error: (err) =>
        this.notify.error('Could not reset the dashboard', apiErrorInfo(err).message),
    });
  }

  private persist(widgets: PlacedWidget[]): void {
    this.proxy.put_dashboard(this.dashboard(), { widgets }).subscribe({
      next: (v) => this.view.set(v),
      error: (err) => {
        this.notify.error('Could not save the layout', apiErrorInfo(err).message);
        this.load(this.dashboard());
      },
    });
  }
}
