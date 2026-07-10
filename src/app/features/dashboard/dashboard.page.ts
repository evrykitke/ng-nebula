import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../core/layout/page-header/page-header';
import { PlaceholderPanel } from '../../shared/components/placeholder-panel/placeholder-panel';

@Component({
  selector: 'app-dashboard-page',
  imports: [PageHeader, PlaceholderPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Dashboard"
      subtitle="An overview of your workspace"
      [breadcrumbs]="[{ label: 'Dashboard' }]"
    />
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <app-placeholder-panel title="Widgets land here" icon="lucideLayoutDashboard" />
      <app-placeholder-panel title="Activity" icon="lucideScrollText" />
      <app-placeholder-panel title="Quick actions" icon="lucideSettings" />
    </div>
  `,
})
export class DashboardPage {}
