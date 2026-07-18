import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { apiErrorInfo } from '../api/api-error';
import { UiButton } from '../ui/button';
import { slugify } from './download';
import { drawPage, openPdf } from './pdf-canvas';
import { ReportFormat, ReportService } from './report.service';

/** What a finished render hands back to whoever asked for it. */
export interface LoadedPdf {
  /** The bytes, for downloading, printing, or opening in a tab. */
  blob: Blob;
  /** The name the server gave the file — it knows the document's number. */
  fileName: string;
  pages: number;
}

/**
 * A report, drawn.
 *
 * Renders whatever the reporting engine produces: asks the server for the PDF,
 * draws every page with pdf.js, and says so when it is working or when it
 * failed. Nothing about *what* is being looked at, and nothing about what to do
 * with it — the panel or page around it owns that.
 *
 * This exists because there were two viewers. The drawer drew PDFs with pdf.js;
 * the report page asked the server to re-render the same document as SVG and
 * dropped it in via `innerHTML`. Two renderers, two server paths, two sets of
 * bugs, one job — and the SVG one could not print, select text, or search.
 */
@Component({
  selector: 'app-pdf-view',
  standalone: true,
  imports: [UiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <p class="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
        Rendering…
      </p>
    } @else if (error()) {
      <div class="absolute inset-0 grid place-items-center px-6 text-center">
        <div>
          <p class="text-sm font-medium text-destructive">Could not render the document</p>
          <p class="mt-1 text-xs text-muted-foreground">{{ error() }}</p>
          <button uiBtn variant="outline" class="mt-3" (click)="load()">Try again</button>
        </div>
      </div>
    }
    <!-- The pages are appended here as canvases, one per page. -->
    <div #pageHost class="flex flex-col items-center gap-3 p-3 sm:gap-4 sm:p-6"></div>
  `,
})
export class PdfView {
  private readonly reports = inject(ReportService);

  /** The report to draw, e.g. `sales-invoice` or `trial-balance`. */
  readonly report = input.required<string>();
  /** The record to draw. Absent for a report that needs no record. */
  readonly id = input<string | null | undefined>(null);
  /** The letterhead. `null` leaves the choice to the server. */
  readonly format = input<ReportFormat | null>(null);
  /**
   * Anything else the report asks for — a statement's `from`/`to`. Kept open
   * rather than typed per report: the engine takes whatever parameters a report
   * declares, and the view does not need to know which.
   */
  readonly params = input<Record<string, string>>({});
  readonly zoom = input(1);
  /**
   * Whether to draw at all. A page that renders this behind a tab switch would
   * otherwise fetch a document nobody is looking at.
   */
  readonly active = input(true);

  readonly loaded = output<LoadedPdf>();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private readonly pageHost = viewChild<ElementRef<HTMLDivElement>>('pageHost');
  private doc: PDFDocumentProxy | null = null;

  /** Redraw when the host's width changes — rotation, sidebar collapse. */
  private observer: ResizeObserver | null = null;
  private hostWidth = 0;
  private repaintTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Re-render whenever what is being asked for changes. `id` is read so a
    // document redraws once its record arrives, but is not required: a report
    // that stands on its own has none.
    effect(() => {
      const active = this.active();
      this.report();
      this.id();
      this.format();
      this.params();
      if (active) queueMicrotask(() => this.load());
      else queueMicrotask(() => this.release());
    });
    // Zoom redraws the pages already in hand — no need to ask the server again.
    effect(() => {
      const zoom = this.zoom();
      if (this.doc) queueMicrotask(() => void this.paint(zoom));
    });
    // Width changes redraw too: the pages are fitted to the host, so a phone
    // rotating (or the layout re-stacking at a breakpoint) needs a repaint.
    // Height changes are the pages themselves being appended — ignored.
    effect(() => {
      const host = this.pageHost()?.nativeElement;
      this.observer?.disconnect();
      this.observer = null;
      if (!host || typeof ResizeObserver === 'undefined') return;
      this.hostWidth = host.clientWidth;
      this.observer = new ResizeObserver(() => {
        const width = host.clientWidth;
        if (width === this.hostWidth) return;
        this.hostWidth = width;
        if (!this.doc) return;
        if (this.repaintTimer) clearTimeout(this.repaintTimer);
        this.repaintTimer = setTimeout(() => void this.paint(this.zoom()), 150);
      });
      this.observer.observe(host);
    });
    inject(DestroyRef).onDestroy(() => {
      this.release();
      this.observer?.disconnect();
      if (this.repaintTimer) clearTimeout(this.repaintTimer);
    });
  }

  load(): void {
    const report = this.report();
    if (!report) return;
    this.loading.set(true);
    this.error.set(null);
    this.reports.renderPdf(report, this.id() ?? null, this.format(), this.params()).subscribe({
      next: async (res) => {
        if (!res.body) {
          this.loading.set(false);
          return;
        }
        this.release();
        const blob = res.body;
        try {
          this.doc = await openPdf(await blob.arrayBuffer());
          await this.paint(this.zoom());
          this.loaded.emit({
            blob,
            fileName: fileNameOf(res.headers.get('content-disposition'), report),
            pages: this.doc.numPages,
          });
        } catch (e) {
          this.error.set(e instanceof Error ? e.message : 'The document could not be read.');
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorInfo(err).message ?? 'The server did not say why.');
      },
    });
  }

  /** Draw every page into the host, replacing whatever was there. */
  private async paint(zoom: number): Promise<void> {
    const host = this.pageHost()?.nativeElement;
    const doc = this.doc;
    if (!host || !doc) return;
    host.replaceChildren();
    const fit = await this.fitScale(doc, host);
    for (let n = 1; n <= doc.numPages; n++) {
      const canvas = document.createElement('canvas');
      canvas.className = 'bg-white shadow-lg';
      host.append(canvas);
      await drawPage(doc, n, canvas, zoom * fit);
    }
  }

  /**
   * How far the pages must shrink for page 1 to fit the host's width — 1 on
   * any screen wide enough for the paper size, so desktop is untouched. A
   * phone gets fit-to-width, and the zoom buttons scale relative to that
   * fitted size rather than the paper's, which they can never reach.
   */
  private async fitScale(doc: PDFDocumentProxy, host: HTMLElement): Promise<number> {
    const natural = (await doc.getPage(1)).getViewport({ scale: 1 }).width;
    const style = getComputedStyle(host);
    const avail =
      host.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return natural > 0 && avail > 0 ? Math.min(1, avail / natural) : 1;
  }

  /** Drop the parsed document and the pages drawn from it. */
  private release(): void {
    void this.doc?.destroy();
    this.doc = null;
    this.pageHost()?.nativeElement.replaceChildren();
  }
}

function fileNameOf(disposition: string | null, report: string): string {
  const match = /filename="?([^";]+)"?/i.exec(disposition ?? '');
  return match?.[1]?.trim() || `${slugify(report)}.pdf`;
}
