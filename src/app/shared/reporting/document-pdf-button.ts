import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileText } from '@ng-icons/lucide';
import { NotificationService } from '../../core/services/notification.service';
import { apiErrorInfo } from '../api/api-error';
import { saveBlob, slugify } from './download';
import { ReportService } from './report.service';
import { UiButton } from '../ui/button';

/**
 * The "PDF" action on a record's detail page: downloads the document the
 * server draws for that record — the purchase order, the invoice, the
 * delivery note.
 *
 * One component rather than the same twenty lines on every detail page: the
 * download is identical everywhere, only the report's name differs. It is a
 * single element, so it projects into a `PageHeader` `actions` slot without
 * the `@if` wrapping that silently drops multi-node content.
 */
@Component({
  selector: 'app-document-pdf',
  standalone: true,
  imports: [NgIcon, UiButton],
  providers: [provideIcons({ lucideFileText })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button uiBtn actions variant="outline" [disabled]="!id() || busy()" (click)="download()">
      <ng-icon name="lucideFileText" size="16" />
      {{ busy() ? 'Preparing…' : label() }}
    </button>
  `,
})
export class DocumentPdfButton {
  private readonly reports = inject(ReportService);
  private readonly notify = inject(NotificationService);

  /** The report that draws this document, e.g. `sales-invoice`. */
  readonly report = input.required<string>();
  /** The record to draw. Empty while the page is still loading it. */
  readonly id = input<string | null | undefined>(null);
  readonly label = input('PDF');

  readonly busy = signal(false);

  download(): void {
    const id = this.id();
    if (!id || this.busy()) return;
    this.busy.set(true);
    this.reports.renderDocument(this.report(), id).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (!res.body) return;
        saveBlob(res.body, this.fileName(res.headers.get('content-disposition')));
      },
      error: (err) => {
        this.busy.set(false);
        const { message } = apiErrorInfo(err);
        this.notify.error('Could not render the document', message);
      },
    });
  }

  /**
   * The name the server gave the file — it knows the document's number, which
   * is what someone filing it will look for. Falls back to the report's name
   * only when the header is missing or unreadable.
   */
  private fileName(disposition: string | null): string {
    const match = /filename="?([^";]+)"?/i.exec(disposition ?? '');
    return match?.[1]?.trim() || `${slugify(this.report())}.pdf`;
  }
}
