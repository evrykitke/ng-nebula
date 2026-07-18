import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { PageSkeleton } from '../../../../shared/ui/skeleton';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { DocumentPdfButton } from '../../../../shared/reporting/document-pdf-button';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { fmtDateTime, fmtMoney, statusLabel } from '../../shared/scm-format';
import { sessionStatusTones, tenderLabel } from '../shared/pos-format';
import {
  PosOrderHeader,
  PosServiceProxy,
  SessionReport,
  SessionView,
} from '../../../../shared/service-proxies/service-proxies';

/**
 * One session, read as its report: the live X while it runs, the stored Z once
 * closed. Deliberately built on the report endpoints rather than `GET
 * /pos/sessions/{id}` — the report carries the session inside it, and the Z is
 * readable with Reports.View alone where the raw session needs Sell.
 */
@Component({
  selector: 'app-pos-session-detail-page',
  imports: [PageSkeleton, RouterLink, PageHeader, DocumentPdfButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-detail.page.html',
})
export class SessionDetailPage {
  private readonly proxy = inject(PosServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly report = signal<SessionReport | null>(null);
  /** Receipts of this session; empty when the caller may not list sales. */
  readonly receipts = signal<PosOrderHeader[]>([]);

  readonly session = computed<SessionView | null>(() => this.report()?.session ?? null);
  readonly isClosed = computed(() => this.session()?.status === 'closed');

  readonly canSell = computed(() => this.auth.hasPermission(Permissions.posSell));

  readonly fmtDateTime = fmtDateTime;
  readonly fmtMoney = fmtMoney;
  readonly statusLabel = statusLabel;
  readonly tenderLabel = tenderLabel;
  readonly tones = sessionStatusTones;

  private id = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.id = params.get('id') ?? '';
      this.load();
    });
  }

  /** Z first (closed sessions, Reports.View); the live X when the Z refuses. */
  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.proxy.z_report(this.id).subscribe({
      next: (r) => this.settle(r),
      error: () => {
        this.proxy.x_report(this.id).subscribe({
          next: (r) => this.settle(r),
          error: (err) => {
            this.error.set(apiErrorInfo(err).message || 'Could not load the session.');
            this.loading.set(false);
          },
        });
      },
    });
  }

  private settle(r: SessionReport): void {
    this.report.set(r);
    this.loading.set(false);
    if (this.canSell()) {
      this.proxy.list_sales(this.id, null).subscribe({
        next: (rows) => this.receipts.set(rows ?? []),
        error: () => this.receipts.set([]),
      });
    }
  }

  variance(line: { variance?: string | undefined }): number {
    return Number(line.variance ?? 0);
  }

  openReceipt(id: string): void {
    void this.router.navigate(['/pos/receipts', id]);
  }
}
