import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideDownload, lucideDroplet, lucideSlidersHorizontal } from '@ng-icons/lucide';
import { UiButton } from '../../shared/ui/button';
import { PageHeader } from '../../core/layout/page-header/page-header';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions.constants';
import { NotificationService } from '../../core/services/notification.service';
import { apiErrorInfo } from '../../shared/api/api-error';
import {
  REPORT_FORMATS,
  ReportFormat,
  ReportInfo,
  ReportOutput,
  ReportService,
  ReportSettings,
} from './report.service';

/**
 * The report viewer: renders a report to PDF in-line and offers the tools
 * around it — a format switcher (Modern / Compact / Corporate), PDF and
 * Excel downloads, and, for admins, the report settings (the workspace's
 * house default format and a watermark) that apply to everyone.
 */
@Component({
  selector: 'app-report-viewer-page',
  imports: [FormsModule, NgIcon, UiButton, PageHeader],
  providers: [provideIcons({ lucideDownload, lucideDroplet, lucideSlidersHorizontal })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-viewer.page.html',
})
export class ReportViewerPage {
  private readonly route = inject(ActivatedRoute);
  private readonly reports = inject(ReportService);
  private readonly auth = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly notify = inject(NotificationService);

  readonly formats = REPORT_FORMATS;
  readonly name = signal('');
  readonly info = signal<ReportInfo | null>(null);
  readonly format = signal<ReportFormat | null>(null);
  readonly rendering = signal(false);
  readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  private objectUrl: string | null = null;

  // Admin report settings.
  readonly canManage = computed(() => this.auth.hasPermission(Permissions.tenantSettings));
  readonly settingsOpen = signal(false);
  readonly savingSettings = signal(false);
  houseFormat: ReportFormat | '' = '';
  watermark = '';

  readonly hasExcel = computed(() => this.info()?.outputs.includes('excel') ?? false);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((pm) => {
      this.name.set(pm.get('name') ?? '');
      this.load();
    });
  }

  private load(): void {
    // Catalogue (for the title/outputs) and settings (for the admin panel
    // and to seed the format the viewer opens with).
    this.reports.list().subscribe({
      next: (list) => {
        const info = list.find((r) => r.name === this.name()) ?? null;
        this.info.set(info);
        if (info && this.format() === null) this.format.set(info.default_format);
        this.render();
      },
      error: (err) => this.notify.error('Could not load the report', apiErrorInfo(err).message),
    });
    this.reports.getSettings().subscribe({
      next: (s) => this.applySettings(s),
      error: () => {},
    });
  }

  private applySettings(s: ReportSettings): void {
    this.houseFormat = s.default_format ?? '';
    this.watermark = s.watermark ?? '';
  }

  render(): void {
    const name = this.name();
    if (!name) return;
    this.rendering.set(true);
    this.reports.render(name, this.format(), 'pdf').subscribe({
      next: (blob) => {
        this.setPdf(blob);
        this.rendering.set(false);
      },
      error: (err) => {
        this.rendering.set(false);
        this.notify.error('Could not render the report', apiErrorInfo(err).message);
      },
    });
  }

  selectFormat(format: ReportFormat): void {
    if (this.format() === format) return;
    this.format.set(format);
    this.render();
  }

  download(output: ReportOutput): void {
    const name = this.name();
    this.reports.render(name, this.format(), output).subscribe({
      next: (blob) => saveBlob(blob, `${name}.${output === 'excel' ? 'xlsx' : 'pdf'}`),
      error: (err) => this.notify.error('Download failed', apiErrorInfo(err).message),
    });
  }

  saveSettings(): void {
    this.savingSettings.set(true);
    this.reports
      .saveSettings({
        default_format: this.houseFormat || null,
        watermark: this.watermark.trim() || null,
      })
      .subscribe({
        next: (s) => {
          this.applySettings(s);
          this.savingSettings.set(false);
          this.settingsOpen.set(false);
          this.notify.success('Report settings saved');
          this.render();
        },
        error: (err) => {
          this.savingSettings.set(false);
          this.notify.error('Could not save settings', apiErrorInfo(err).message);
        },
      });
  }

  private setPdf(blob: Blob): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(blob);
    this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
  }

  ngOnDestroy(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }
}

/** Trigger a browser download of a rendered blob. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
