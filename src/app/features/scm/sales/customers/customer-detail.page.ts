import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { DateTime } from 'luxon';
import { UiButton } from '../../../../shared/ui/button';
import { UiDatepicker } from '../../../../shared/ui/datepicker';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { DocumentPdfButton } from '../../../../shared/reporting/document-pdf-button';
import { AuthService } from '../../../../core/auth/auth.service';
import { Permissions } from '../../../../core/auth/permissions.constants';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { asDateString, fmtDate, fmtMoney } from '../../shared/scm-format';
import {
  SalesCustomer,
  SalesServiceProxy,
  StatementView,
} from '../../../../shared/service-proxies/service-proxies';

/** One customer: master details plus an on-demand account statement. */
@Component({
  selector: 'app-customer-detail-page',
  imports: [FormsModule, RouterLink, NgIcon, UiButton, UiDatepicker, PageHeader, DocumentPdfButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-detail.page.html',
})
export class CustomerDetailPage {
  private readonly proxy = inject(SalesServiceProxy);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly canEdit = computed(() => this.auth.hasPermission(Permissions.customersEdit));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly customer = signal<SalesCustomer | null>(null);

  readonly statement = signal<StatementView | null>(null);
  readonly statementLoading = signal(false);
  // Signals, not plain fields: the statement's PDF is parameterised by these,
  // and a bound object rebuilt on every check would re-render the drawer on
  // every check.
  readonly from = signal<DateTime | undefined>(DateTime.now().startOf('month'));
  readonly to = signal<DateTime | undefined>(DateTime.now());

  /** The period the statement PDF draws — the one on screen. */
  readonly statementParams = computed(() => ({
    from: this.from()?.toFormat('yyyy-LL-dd') ?? '',
    to: this.to()?.toFormat('yyyy-LL-dd') ?? '',
  }));

  private id = '';

  readonly fmtDate = fmtDate;
  readonly fmtMoney = fmtMoney;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.id = params.get('id') ?? '';
      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.statement.set(null);
    this.proxy.get_customer(this.id).subscribe({
      next: (c) => {
        this.customer.set(c);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorInfo(err).message || 'Could not load the customer.');
        this.loading.set(false);
      },
    });
  }

  edit(): void {
    void this.router.navigate(['/sales/customers', this.id, 'edit']);
  }

  runStatement(): void {
    const from = this.from();
    const to = this.to();
    if (!from || !to) return;
    this.statementLoading.set(true);
    this.proxy.statement_json(this.id, asDateString(from), asDateString(to)).subscribe({
      next: (s) => {
        this.statement.set(s);
        this.statementLoading.set(false);
      },
      error: () => {
        this.statementLoading.set(false);
      },
    });
  }
}
