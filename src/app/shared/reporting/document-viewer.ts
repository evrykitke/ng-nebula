import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideDownload,
  lucideExternalLink,
  lucideLock,
  lucideMail,
  lucideX,
} from '@ng-icons/lucide';
import { NotificationService } from '../../core/services/notification.service';
import { apiErrorInfo } from '../api/api-error';
import { UiButton } from '../ui/button';
import { saveBlob, slugify } from './download';
import { REPORT_FORMATS, ReportFormat, ReportService } from './report.service';

/**
 * A record's document, shown before it goes anywhere: a panel over the page
 * holding the rendered PDF, with the things one actually does with a trade
 * document — read it, file it, send it.
 *
 * The preview is the browser's own PDF viewer in an iframe. That is deliberate:
 * it already paginates, zooms, searches and prints, it is what the reader knows,
 * and the alternative — shipping pdf.js — is a megabyte of dependency to rebuild
 * what is already there. The panel's own bar carries only what the viewer has
 * no opinion about: which letterhead to draw, and where the file goes next.
 */
@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [FormsModule, NgIcon, UiButton],
  providers: [
    provideIcons({ lucideX, lucideDownload, lucideMail, lucideExternalLink, lucideLock }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex justify-end">
        <!-- Backdrop: dismisses, and dims the page it slides over. -->
        <div class="absolute inset-0 bg-black/40" (click)="close.emit()"></div>

        <section
          class="relative flex h-full w-full flex-col border-l border-border bg-card shadow-2xl sm:w-3/4"
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
            <label class="text-xs text-muted-foreground">Letterhead</label>
            <select
              class="rounded-md border border-border bg-background px-2 py-1 text-xs capitalize"
              [ngModel]="format()"
              (ngModelChange)="format.set($event)"
            >
              @for (f of formats; track f) {
                <option [value]="f">{{ f }}</option>
              }
            </select>

            <span class="ml-auto"></span>

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

          <div class="relative flex-1 overflow-hidden bg-muted/40">
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
            } @else if (src()) {
              <iframe [src]="src()" class="h-full w-full border-0" title="Document preview"></iframe>
            }
          </div>
        </section>
      </div>
    }
  `,
})
export class DocumentViewer {
  private readonly reports = inject(ReportService);
  private readonly notify = inject(NotificationService);
  private readonly sanitizer = inject(DomSanitizer);

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

  readonly formats = REPORT_FORMATS;
  readonly format = signal<ReportFormat>('corporate');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly blob = signal<Blob | null>(null);
  readonly src = signal<SafeResourceUrl | null>(null);
  readonly composing = signal(false);

  to = '';
  subject = '';
  message = '';
  protect = false;
  password = '';

  readonly title = computed(() => this.heading() || prettify(this.report()));

  /** The object URL behind {@link src}, kept so it can be released. */
  private objectUrl: string | null = null;
  private fileName = '';

  constructor() {
    // Render on opening, and again whenever the letterhead is switched.
    effect(() => {
      const open = this.open();
      const format = this.format();
      const id = this.id();
      if (open && id) {
        queueMicrotask(() => this.load(format));
      } else if (!open) {
        queueMicrotask(() => this.release());
      }
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
      next: (res) => {
        this.loading.set(false);
        if (!res.body) return;
        this.release();
        this.blob.set(res.body);
        this.fileName = fileNameOf(res.headers.get('content-disposition'), this.report());
        this.objectUrl = URL.createObjectURL(res.body);
        this.src.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorInfo(err).message ?? 'The server did not say why.');
      },
    });
  }

  download(): void {
    const blob = this.blob();
    if (blob) saveBlob(blob, this.fileName);
  }

  openInTab(): void {
    if (this.objectUrl) window.open(this.objectUrl, '_blank');
  }

  /** Drop the rendered bytes and the URL holding them. */
  private release(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.src.set(null);
    this.blob.set(null);
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
