import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideGripVertical,
  lucideMinus,
  lucideRefreshCw,
  lucideTrendingDown,
  lucideTrendingUp,
} from '@ng-icons/lucide';
import { Skeleton } from '../../../shared/ui/skeleton';
import { apiErrorInfo } from '../../../shared/api/api-error';
import {
  DashboardServiceProxy,
  PlacedWidgetView,
  TrendDirection,
  WidgetData,
} from '../../../shared/service-proxies/service-proxies';
import { DashboardChart } from './dashboard-chart';

/**
 * One tile of a dashboard canvas: the card, its title, and whichever body
 * its kind promises — stat, chart, table, list or progress.
 *
 * Data is fetched lazily, per tile, when the tile first scrolls into view:
 * a dashboard of twelve widgets costs one layout request up front and then
 * only the queries for what is actually on screen. The placement endpoint
 * deliberately carries no figures, so this component owns the whole
 * loading story — skeleton, payload, or a retryable error.
 */
@Component({
  selector: 'app-dashboard-widget',
  imports: [NgIcon, Skeleton, DashboardChart],
  providers: [
    provideIcons({
      lucideGripVertical,
      lucideMinus,
      lucideRefreshCw,
      lucideTrendingDown,
      lucideTrendingUp,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  templateUrl: './dashboard-widget.html',
})
export class DashboardWidget implements OnDestroy {
  private readonly proxy = inject(DashboardServiceProxy);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly dashboard = input.required<string>();
  readonly widget = input.required<PlacedWidgetView>();

  readonly data = signal<WidgetData | null>(null);
  readonly error = signal<string | null>(null);

  private observer?: IntersectionObserver;
  private requested = false;

  constructor() {
    // Fetch on first visibility, not on construction: tiles below the fold
    // cost nothing until scrolled to.
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') {
        this.reload();
        return;
      }
      this.observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting) && !this.requested) {
            this.reload();
            this.observer?.disconnect();
          }
        },
        { rootMargin: '100px' },
      );
      this.observer.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  reload(): void {
    this.requested = true;
    this.error.set(null);
    this.proxy.widget_data(this.dashboard(), this.widget().name).subscribe({
      next: (d) => this.data.set(d),
      error: (err) => this.error.set(apiErrorInfo(err).message ?? 'Could not load this widget.'),
    });
  }

  protected trendIcon(t: TrendDirection | undefined): string {
    return t === 'up' ? 'lucideTrendingUp' : t === 'down' ? 'lucideTrendingDown' : 'lucideMinus';
  }

  protected trendClass(t: TrendDirection | undefined): string {
    return t === 'up' ? 'text-success' : t === 'down' ? 'text-destructive' : 'text-muted-foreground';
  }

  protected clampPct(v: number): number {
    return Math.max(0, Math.min(1, v)) * 100;
  }
}
