import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileText } from '@ng-icons/lucide';
import { ReportDrawer } from './report-drawer';
import { UiButton } from '../ui/button';

/**
 * The "PDF" action on a record's detail page: opens the document the server
 * draws for that record — the purchase order, the invoice, the delivery note.
 *
 * It shows the document rather than pushing it straight to the downloads
 * folder: a trade document is normally read, checked and only then sent, and a
 * file that lands unseen tends to be opened, found wrong, and re-sent.
 *
 * One component rather than the same twenty lines on every detail page: the
 * panel is identical everywhere, only the report's name differs. It is a
 * single element, so it projects into a `PageHeader` `actions` slot without
 * the `@if` wrapping that silently drops multi-node content.
 */
@Component({
  selector: 'app-document-pdf',
  standalone: true,
  imports: [NgIcon, UiButton, ReportDrawer],
  providers: [provideIcons({ lucideFileText })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button uiBtn actions variant="outline" [disabled]="!id()" (click)="viewing.set(true)">
      <ng-icon name="lucideFileText" size="16" />
      {{ label() }}
    </button>

    <app-report-drawer
      [report]="report()"
      [id]="id()"
      [open]="viewing()"
      [heading]="heading()"
      [number]="number()"
      (close)="viewing.set(false)"
    />
  `,
})
export class DocumentPdfButton {
  /** The report that draws this document, e.g. `sales-invoice`. */
  readonly report = input.required<string>();
  /** The record to draw. Empty while the page is still loading it. */
  readonly id = input<string | null | undefined>(null);
  readonly label = input('PDF');
  /** Panel heading; defaults to the report's name. */
  readonly heading = input<string>('');
  /** The document's own number, shown under the heading. */
  readonly number = input<string>('');

  readonly viewing = signal(false);
}
