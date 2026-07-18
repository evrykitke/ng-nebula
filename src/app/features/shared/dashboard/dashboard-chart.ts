import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChartData } from '../../../shared/service-proxies/service-proxies';

/**
 * The chart half of the widget vocabulary, drawn as inline SVG so a
 * dashboard needs no charting library: line, area, bar, stacked bar, pie
 * and donut, matching the backend's `ChartType`. Values arrive as plain
 * numbers — exactness belongs to the books; a chart only draws proportions.
 *
 * The first series takes the theme's primary colour so every dashboard
 * inherits its tenant theme; later series use fixed accents that read on
 * both light and dark backgrounds.
 */

const PALETTE = [
  'var(--primary)',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#94a3b8',
];

/** Plot geometry, shared by every cartesian chart. */
const W = 600;
const H = 230;
const M = { l: 46, r: 10, t: 12, b: 26 };
const PLOT_W = W - M.l - M.r;
const PLOT_H = H - M.t - M.b;

interface Tick {
  y: number;
  label: string;
}
interface XLabel {
  x: number;
  label: string;
}
interface Bar {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  title: string;
}
interface Slice {
  d: string;
  color: string;
  title: string;
}
interface LegendEntry {
  color: string;
  label: string;
  value?: string;
}

/** 1234567 → "1.2M": axis space is scarce, precision is the tooltip's job. */
function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return trim(v / 1e9) + 'B';
  if (a >= 1e6) return trim(v / 1e6) + 'M';
  if (a >= 1e3) return trim(v / 1e3) + 'k';
  return trim(v);
}
function trim(v: number): string {
  return String(Math.round(v * 10) / 10);
}

/** A pleasant tick step ≥ the raw one: 1/2/5 × 10^k. */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) {
    if (m * mag >= raw) return m * mag;
  }
  return 10 * mag;
}

@Component({
  selector: 'app-dashboard-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-chart.html',
})
export class DashboardChart {
  readonly data = input.required<ChartData>();

  protected readonly w = W;
  protected readonly h = H;
  protected readonly m = M;

  protected readonly radial = computed(
    () => this.data().chart === 'pie' || this.data().chart === 'donut',
  );
  protected readonly isBars = computed(
    () => this.data().chart === 'bar' || this.data().chart === 'stacked_bar',
  );

  protected color(i: number): string {
    return PALETTE[i % PALETTE.length];
  }

  /** Value domain across every series — stacked charts sum per bucket. */
  private readonly domain = computed<{ min: number; max: number }>(() => {
    const d = this.data();
    let min = 0;
    let max = 0;
    if (d.chart === 'stacked_bar') {
      for (let i = 0; i < d.labels.length; i++) {
        let pos = 0;
        let neg = 0;
        for (const s of d.series) {
          const v = s.values[i] ?? 0;
          if (v >= 0) pos += v;
          else neg += v;
        }
        max = Math.max(max, pos);
        min = Math.min(min, neg);
      }
    } else {
      for (const s of d.series) {
        for (const v of s.values) {
          max = Math.max(max, v);
          min = Math.min(min, v);
        }
      }
    }
    if (min === 0 && max === 0) max = 1;
    return { min, max };
  });

  /** Four intervals of a nice step, spanning the domain (zero included). */
  private readonly scale = computed(() => {
    const { min, max } = this.domain();
    const step = niceStep((max - min) / 4);
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const y = (v: number) => M.t + PLOT_H - ((v - lo) / (hi - lo)) * PLOT_H;
    return { lo, hi, step, y };
  });

  protected readonly ticks = computed<Tick[]>(() => {
    const { lo, hi, step, y } = this.scale();
    const out: Tick[] = [];
    for (let v = lo; v <= hi + step / 2; v += step) {
      out.push({ y: y(v), label: compact(v) });
    }
    return out;
  });

  private xAt(i: number): number {
    const n = this.data().labels.length;
    if (this.isBars()) {
      const band = PLOT_W / Math.max(n, 1);
      return M.l + band * i + band / 2;
    }
    return n <= 1 ? M.l + PLOT_W / 2 : M.l + (PLOT_W / (n - 1)) * i;
  }

  /** At most ~8 x labels, however many buckets there are. */
  protected readonly xLabels = computed<XLabel[]>(() => {
    const labels = this.data().labels;
    const step = Math.max(1, Math.ceil(labels.length / 8));
    return labels
      .map((label, i) => ({ x: this.xAt(i), label, i }))
      .filter(({ i }) => i % step === 0);
  });

  protected readonly lines = computed<string[]>(() => {
    if (this.isBars() || this.radial()) return [];
    const { y } = this.scale();
    return this.data().series.map((s) =>
      s.values.map((v, i) => `${this.xAt(i)},${y(v)}`).join(' '),
    );
  });

  /** The filled shape under each line — only the `area` type draws it. */
  protected readonly areas = computed<string[]>(() => {
    if (this.data().chart !== 'area') return [];
    const { y } = this.scale();
    const base = y(0);
    return this.data().series.map((s) => {
      const pts = s.values.map((v, i) => `${this.xAt(i)},${y(v)}`).join(' ');
      const first = this.xAt(0);
      const last = this.xAt(s.values.length - 1);
      return `${first},${base} ${pts} ${last},${base}`;
    });
  });

  protected readonly bars = computed<Bar[]>(() => {
    if (!this.isBars()) return [];
    const d = this.data();
    const { y } = this.scale();
    const base = y(0);
    const n = Math.max(d.labels.length, 1);
    const band = PLOT_W / n;
    const inner = band * 0.7;
    const out: Bar[] = [];
    if (d.chart === 'stacked_bar') {
      for (let i = 0; i < d.labels.length; i++) {
        let posTop = 0;
        let negTop = 0;
        d.series.forEach((s, si) => {
          const v = s.values[i] ?? 0;
          if (v === 0) return;
          const from = v > 0 ? posTop : negTop;
          const to = from + v;
          if (v > 0) posTop = to;
          else negTop = to;
          out.push({
            x: M.l + band * i + (band - inner) / 2,
            y: Math.min(y(from), y(to)),
            w: inner,
            h: Math.abs(y(from) - y(to)),
            color: this.color(si),
            title: `${d.labels[i]} — ${s.name}: ${compact(v)}`,
          });
        });
      }
    } else {
      const per = inner / Math.max(d.series.length, 1);
      d.series.forEach((s, si) => {
        s.values.forEach((v, i) => {
          out.push({
            x: M.l + band * i + (band - inner) / 2 + per * si,
            y: Math.min(base, y(v)),
            w: Math.max(per - 2, 2),
            h: Math.abs(base - y(v)),
            color: this.color(si),
            title: `${d.labels[i]} — ${s.name}: ${compact(v)}`,
          });
        });
      });
    }
    return out;
  });

  /** Pie/donut segments over the first series, one per label. */
  protected readonly slices = computed<Slice[]>(() => {
    if (!this.radial()) return [];
    const d = this.data();
    const values = d.series[0]?.values ?? [];
    const total = values.reduce((a, v) => a + Math.max(v, 0), 0);
    if (total <= 0) {
      return [
        {
          d: arcPath(115, 115, 100, d.chart === 'donut' ? 58 : 0, 0, 359.98),
          color: 'var(--muted)',
          title: 'No data',
        },
      ];
    }
    const inner = d.chart === 'donut' ? 58 : 0;
    let angle = 0;
    const out: Slice[] = [];
    values.forEach((v, i) => {
      if (v <= 0) return;
      const sweep = Math.min((v / total) * 360, 359.98);
      out.push({
        d: arcPath(115, 115, 100, inner, angle, angle + sweep),
        color: this.color(i),
        title: `${d.labels[i]}: ${compact(v)}`,
      });
      angle += sweep;
    });
    return out;
  });

  protected readonly legend = computed<LegendEntry[]>(() => {
    const d = this.data();
    if (this.radial()) {
      const values = d.series[0]?.values ?? [];
      return d.labels.map((label, i) => ({
        color: this.color(i),
        label,
        value: compact(values[i] ?? 0),
      }));
    }
    return d.series.map((s, i) => ({ color: this.color(i), label: s.name }));
  });
}

/** An annular (or full) sector from `start` to `end` degrees, 12 o'clock zero. */
function arcPath(cx: number, cy: number, r: number, inner: number, start: number, end: number): string {
  const large = end - start > 180 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, r, start);
  const [x2, y2] = polar(cx, cy, r, end);
  if (inner <= 0) {
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  }
  const [x3, y3] = polar(cx, cy, inner, end);
  const [x4, y4] = polar(cx, cy, inner, start);
  return (
    `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} ` +
    `L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`
  );
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [
    Math.round((cx + r * Math.cos(rad)) * 100) / 100,
    Math.round((cy + r * Math.sin(rad)) * 100) / 100,
  ];
}
