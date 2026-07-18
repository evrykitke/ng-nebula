import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSettings2 } from '@ng-icons/lucide';
import { PageHeader } from '../../core/layout/page-header/page-header';
import { UiButton } from '../../shared/ui/button';
import { DashboardCanvas } from '../shared/dashboard/dashboard-canvas';

/**
 * The workspace dashboard — the cross-cutting numbers, one glance after
 * signing in. The canvas is the shared widget system; this page only
 * names it and hands the header's Customize button to it.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [NgIcon, PageHeader, UiButton, DashboardCanvas],
  providers: [provideIcons({ lucideSettings2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {}
