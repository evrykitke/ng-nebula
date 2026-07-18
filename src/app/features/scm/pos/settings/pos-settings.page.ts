import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon } from '@ng-icons/core';
import { UiButton } from '../../../../shared/ui/button';
import { PageSkeleton } from '../../../../shared/ui/skeleton';
import { PageHeader } from '../../../../core/layout/page-header/page-header';
import { NotificationService } from '../../../../core/services/notification.service';
import { apiErrorInfo } from '../../../../shared/api/api-error';
import { fmtMoney, num } from '../../shared/scm-format';
import { PosServiceProxy } from '../../../../shared/service-proxies/service-proxies';

/**
 * The POS policies a tenant sets: whether cashiers count blind, which notes
 * and coins the count sheet offers, whether an M-Pesa tender must carry its
 * confirmation code, and the receipt paper the tills print to. Server-side
 * rules worth knowing
 * here: blind never binds anyone holding Reports.View, and the server always
 * checks counted-vs-expected itself regardless.
 */
@Component({
  selector: 'app-pos-settings-page',
  imports: [FormsModule, NgIcon, UiButton, PageSkeleton, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos-settings.page.html',
})
export class PosSettingsPage {
  private readonly proxy = inject(PosServiceProxy);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(true);
  readonly busy = signal(false);

  blindCount = false;
  denominations: string[] = [];
  newDenomination = '';
  requireMpesaReference = true;
  paperWidth = 80;
  paperMargin = 4;
  fontSize = 12;
  showCompanyName = true;
  showAddress = true;
  showContacts = true;
  showTaxIds = true;

  readonly fmtMoney = fmtMoney;
  /** The widths thermal rolls actually come in. */
  readonly paperPresets = [58, 80];

  constructor() {
    this.proxy.get_settings().subscribe({
      next: (s) => {
        this.blindCount = s.blind_count;
        this.denominations = [...s.denominations];
        this.requireMpesaReference = s.require_mpesa_reference;
        this.paperWidth = s.receipt_paper_width_mm;
        this.paperMargin = s.receipt_margin_mm;
        this.fontSize = s.receipt_font_size_px;
        this.showCompanyName = s.receipt_show_company_name;
        this.showAddress = s.receipt_show_address;
        this.showContacts = s.receipt_show_contacts;
        this.showTaxIds = s.receipt_show_tax_ids;
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Could not load POS settings', apiErrorInfo(err).message);
      },
    });
  }

  addDenomination(): void {
    const value = num(this.newDenomination);
    if (value <= 0) {
      this.notify.error('A denomination must be a positive amount.');
      return;
    }
    if (this.denominations.some((d) => num(d) === value)) {
      this.notify.error('That denomination is already in the set.');
      return;
    }
    this.denominations = [...this.denominations, String(value)].sort((a, b) => num(b) - num(a));
    this.newDenomination = '';
  }

  removeDenomination(d: string): void {
    this.denominations = this.denominations.filter((x) => x !== d);
  }

  save(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.proxy
      .put_settings({
        blind_count: this.blindCount,
        denominations: this.denominations,
        require_mpesa_reference: this.requireMpesaReference,
        receipt_paper_width_mm: num(this.paperWidth),
        receipt_margin_mm: num(this.paperMargin),
        receipt_font_size_px: num(this.fontSize),
        receipt_show_company_name: this.showCompanyName,
        receipt_show_address: this.showAddress,
        receipt_show_contacts: this.showContacts,
        receipt_show_tax_ids: this.showTaxIds,
      })
      .subscribe({
        next: (s) => {
          this.busy.set(false);
          this.blindCount = s.blind_count;
          this.denominations = [...s.denominations];
          this.requireMpesaReference = s.require_mpesa_reference;
          this.paperWidth = s.receipt_paper_width_mm;
          this.paperMargin = s.receipt_margin_mm;
          this.fontSize = s.receipt_font_size_px;
          this.showCompanyName = s.receipt_show_company_name;
          this.showAddress = s.receipt_show_address;
          this.showContacts = s.receipt_show_contacts;
          this.showTaxIds = s.receipt_show_tax_ids;
          this.notify.success('POS settings saved');
        },
        error: (err) => {
          this.busy.set(false);
          this.notify.error(apiErrorInfo(err).message || 'Could not save the settings.');
        },
      });
  }
}
