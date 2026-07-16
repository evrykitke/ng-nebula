import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideDownload,
  lucideExternalLink,
  lucideLock,
  lucideMail,
  lucideMinus,
  lucidePlus,
  lucidePrinter,
  lucideX,
} from '@ng-icons/lucide';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { LayoutService, SIDEBAR_RAIL, SIDEBAR_WIDTH } from '../../core/layout/layout.service';
import { apiErrorInfo } from '../api/api-error';
import { UiButton } from '../ui/button';
import { saveBlob, slugify } from './download';
import { drawPage, openPdf } from './pdf-canvas';
import { REPORT_FORMATS, ReportFormat, ReportService } from './report.service';

/** The zoom steps the − / + buttons walk through. */
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/**
 * A record's document, shown before it goes anywhere: a panel over the page
 * holding the rendered PDF, with the things one actually does with a trade
 * document — read it, file it, send it.
 *
 * The pages are drawn by pdf.js into our own chrome rather than handed to the
 * browser's PDF plugin: the plugin cannot be themed, titles the document with
 * the blob's uuid, and behaves differently in every browser. pdf.js is the same
 * engine Firefox ships, so "our own viewer" is not a rebuild of PDF rendering —
 * only of the toolbar around it.
 */
@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [FormsModule, NgIcon, UiButton],
  providers: [
    provideIcons({
      lucideX,
      lucideDownload,
      lucideMail,
      lucideExternalLink,
      lucideLock,
      lucidePlus,
      lucideMinus,
      lucidePrinter,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <!-- Starts where the sidebar ends: the nav stays visible and usable, and
           the panel takes everything else rather than crossing under it. -->
      <div
        class="fixed inset-y-0 right-0 z-50 flex justify-end transition-[left] duration-200"
        [style.left.px]="leftInset()"
      >
        <section
          class="relative flex h-full w-full flex-col border-l border-border bg-card shadow-2xl"
          role="dialog"
          aria-label="Document preview"
        >
          <header class="flex items-start justify-between gap-4 border-b border-border px-5 py-3.5">
            <div class="min-w-0">
              <h2 class="truncate text-sm font-semibold text-foreground">{{ title() }}</h2>
              @if (number()) {
                <p class="mt-0.5 font-mono text-xs text-muted-foreground">#{{ number() }}</p>
              }
            </div>
            <button
              type="button"
              class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Close"
              (click)="close.emit()"
            >
              <ng-icon name="lucideX" size="18" />
            </button>
          </header>

          <div class="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
            <select
              class="rounded-md border border-border bg-background px-2 py-1 text-xs capitalize"
              [ngModel]="format()"
              (ngModelChange)="format.set($event)"
              aria-label="Letterhead"
            >
              @for (f of formats; track f) {
                <option [value]="f">{{ f }}</option>
              }
            </select>

            <div class="ml-2 flex items-center gap-1">
              <button
                type="button"
                class="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-40"
                aria-label="Zoom out"
                [disabled]="!canZoomOut()"
                (click)="zoomBy(-1)"
              >
                <ng-icon name="lucideMinus" size="15" />
              </button>
              <span class="w-12 text-center text-xs tabular-nums text-muted-foreground">
                {{ zoomPercent() }}%
              </span>
              <button
                type="button"
                class="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-40"
                aria-label="Zoom in"
                [disabled]="!canZoomIn()"
                (click)="zoomBy(1)"
              >
                <ng-icon name="lucidePlus" size="15" />
              </button>
            </div>

            @if (pages()) {
              <span class="text-xs text-muted-foreground">
                {{ pages() }} {{ pages() === 1 ? 'page' : 'pages' }}
              </span>
            }

            <span class="ml-auto"></span>

            <button uiBtn variant="outline" [disabled]="!blob()" (click)="print()">
              <ng-icon name="lucidePrinter" size="15" /> Print
            </button>
            <button uiBtn variant="outline" [disabled]="!blob()" (click)="openInTab()">
              <ng-icon name="lucideExternalLink" size="15" /> Open
            </button>
            <button uiBtn variant="outline" [disabled]="!blob()" (click)="download()">
              <ng-icon name="lucideDownload" size="15" /> Download
            </button>
            <button uiBtn [disabled]="!blob()" (click)="composing.set(!composing())">
              <ng-icon name="lucideMail" size="15" /> Email
            </button>
          </div>

          @if (composing()) {
            <div class="border-b border-border bg-muted/30 px-5 py-4">
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="text-xs font-medium text-foreground">
                  To
                  <input
                    type="email"
                    placeholder="name@example.com"
                    class="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    [(ngModel)]="to"
                  />
                </label>
                <label class="text-xs font-medium text-foreground">
                  Subject
                  <input
                    type="text"
                    class="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    [(ngModel)]="subject"
                  />
                </label>
              </div>
              <label class="mt-3 block text-xs font-medium text-foreground">
                Message
                <textarea
                  rows="3"
                  class="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  [(ngModel)]="message"
                ></textarea>
              </label>

              <label class="mt-3 flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" [(ngModel)]="protect" />
                <ng-icon name="lucideLock" size="14" />
                Password-protect the attachment
              </label>
              @if (protect) {
                <input
                  type="text"
                  placeholder="Password for the recipient"
                  class="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm sm:w-72"
                  [(ngModel)]="password"
                />
              }

              <div class="mt-4 flex items-center gap-3">
                <button uiBtn disabled title="Mail delivery is not wired up yet">Send</button>
                <button uiBtn variant="ghost" (click)="composing.set(false)">Cancel</button>
                <p class="text-xs text-muted-foreground">
                  Sending is not connected yet — neither the mailer nor PDF encryption exists on the
                  server. The form is here so the wiring has somewhere to land.
                </p>
              </div>
            </div>
          }

          <div class="relative flex-1 overflow-auto bg-neutral-200 dark:bg-neutral-900">
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
            <div #pageHost class="flex flex-col items-center gap-4 p-6"></div>
          </div>
        </section>
      </div>
    }
  `,
})
export class DocumentViewer {
  private readonly reports = inject(ReportService);
  private readonly layout = inject(LayoutService);

  /**
   * Where the panel's left edge sits: hard against the sidebar's right edge,
   * tracking it as it collapses. Off-canvas on mobile, where the sidebar is
   * itself an overlay and the panel takes the whole window.
   */
  readonly leftInset = computed(() =>
    this.layout.isMobile() ? 0 : this.layout.collapsed() ? SIDEBAR_RAIL : SIDEBAR_WIDTH,
  );

  /** The report that draws this document, e.g. `sales-invoice`. */
  readonly report = input.required<string>();
  /** The record to draw. */
  readonly id = input<string | null | undefined>(null);
  readonly open = input(false);
  /** Heading for the panel; defaults to the report's name, prettified. */
  readonly heading = input<string>('');
  /** The document's own number, shown under the heading. */
  readonly number = input<string>('');

  readonly close = output<void>();

  private readonly pageHost = viewChild<ElementRef<HTMLDivElement>>('pageHost');

  readonly formats = REPORT_FORMATS;
  readonly format = signal<ReportFormat>('corporate');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly blob = signal<Blob | null>(null);
  readonly pages = signal(0);
  readonly composing = signal(false);
  readonly zoom = signal(1);

  to = '';
  subject = '';
  message = '';
  protect = false;
  password = '';

  readonly title = computed(() => this.heading() || prettify(this.report()));
  readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));
  readonly canZoomIn = computed(() => this.zoom() < ZOOMS[ZOOMS.length - 1]);
  readonly canZoomOut = computed(() => this.zoom() > ZOOMS[0]);

  private doc: PDFDocumentProxy | null = null;
  private objectUrl: string | null = null;
  private fileName = '';

  constructor() {
    // Render on opening, and again whenever the letterhead is switched.
    effect(() => {
      const open = this.open();
      const format = this.format();
      const id = this.id();
      if (open && id) queueMicrotask(() => this.load(format));
      else if (!open) queueMicrotask(() => this.release());
    });
    // Zoom redraws the pages already in hand — no need to ask the server again.
    effect(() => {
      const zoom = this.zoom();
      if (this.doc) queueMicrotask(() => void this.paint(zoom));
    });
    inject(DestroyRef).onDestroy(() => this.release());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close.emit();
  }

  load(format: ReportFormat = this.format()): void {
    const id = this.id();
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    this.reports.renderDocument(this.report(), id, format).subscribe({
      next: async (res) => {
        if (!res.body) {
          this.loading.set(false);
          return;
        }
        this.release();
        this.blob.set(res.body);
        this.fileName = fileNameOf(res.headers.get('content-disposition'), this.report());
        try {
          this.doc = await openPdf(await res.body.arrayBuffer());
          this.pages.set(this.doc.numPages);
          await this.paint(this.zoom());
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
    for (let n = 1; n <= doc.numPages; n++) {
      const canvas = document.createElement('canvas');
      canvas.className = 'bg-white shadow-lg';
      host.append(canvas);
      await drawPage(doc, n, canvas, zoom);
    }
  }

  zoomBy(step: number): void {
    const i = ZOOMS.indexOf(this.zoom());
    const next = ZOOMS[Math.min(Math.max((i < 0 ? 2 : i) + step, 0), ZOOMS.length - 1)];
    this.zoom.set(next);
  }

  download(): void {
    const blob = this.blob();
    if (blob) saveBlob(blob, this.fileName);
  }

  /** The file's own URL, made only when something needs to point at it. */
  private url(): string | null {
    const blob = this.blob();
    if (!blob) return null;
    this.objectUrl ??= URL.createObjectURL(blob);
    return this.objectUrl;
  }

  openInTab(): void {
    const url = this.url();
    if (url) window.open(url, '_blank');
  }

  /**
   * Printing goes through the browser's own PDF pipeline rather than the
   * canvases: a canvas prints as a picture of the page, which comes out soft
   * and cannot be searched or selected.
   */
  print(): void {
    const url = this.url();
    if (!url) return;
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.src = url;
    frame.onload = () => frame.contentWindow?.print();
    document.body.append(frame);
    // Long enough for the print dialog to take its own copy of the document.
    setTimeout(() => frame.remove(), 60_000);
  }

  /** Drop the rendered bytes, the parsed document and the URL holding them. */
  private release(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    void this.doc?.destroy();
    this.doc = null;
    this.pages.set(0);
    this.blob.set(null);
    this.pageHost()?.nativeElement.replaceChildren();
  }
}

/** The name the server gave the file — it knows the document's number. */
function fileNameOf(disposition: string | null, report: string): string {
  const match = /filename="?([^";]+)"?/i.exec(disposition ?? '');
  return match?.[1]?.trim() || `${slugify(report)}.pdf`;
}

function prettify(name: string): string {
  const words = name.replace(/[-_]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Document';
}
