import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';
import { LayoutService } from '../layout.service';

/**
 * Root layout: sidebar + topbar wrapping a scrollable content area. On desktop
 * the sidebar is a persistent rail; below `lg` it becomes an off-canvas drawer
 * rendered over the content with a dismissable backdrop.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Topbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-screen w-full overflow-hidden bg-background">
      <app-sidebar />

      <!-- Mobile drawer backdrop -->
      @if (layout.isMobile() && layout.mobileOpen()) {
        <div
          class="fixed inset-0 z-40 bg-black/40 lg:hidden"
          (click)="layout.closeMobile()"
          aria-hidden="true"
        ></div>
      }

      <div class="flex min-w-0 flex-1 flex-col">
        <app-topbar class="shrink-0" />
        <main #content class="flex-1 overflow-y-auto p-4 sm:p-5">
          <router-outlet (activate)="onActivate(content)" />
        </main>
      </div>
    </div>
  `,
})
export class AppShell {
  readonly layout = inject(LayoutService);

  /** Ease each newly-activated page in by replaying the entrance animation. */
  onActivate(content: HTMLElement): void {
    content.classList.remove('page-enter');
    // Force a reflow so the animation restarts even on same-class navigations.
    void content.offsetWidth;
    content.classList.add('page-enter');
    // Drop it once it has played. The animation fills, so it never stops
    // applying — and an element whose transform is under animation control is
    // the containing block for its `position: fixed` descendants. Left on, it
    // quietly trapped every overlay (modals, the document panel) inside the
    // content area instead of the window. The animation's end state is the
    // element's natural state, so removing the class shows nothing.
    content.addEventListener('animationend', () => content.classList.remove('page-enter'), {
      once: true,
    });
  }
}
