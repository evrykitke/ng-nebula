import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { NgIcon } from '@ng-icons/core';
import { filter, map } from 'rxjs';
import { UiTooltip } from '../../../shared/ui/tooltip';
import { NavItem } from '../nav.model';
import { SidebarMenuService } from './sidebar-menu.service';

/**
 * Recursive sidebar entry. Renders a leaf link or an expandable parent that
 * nests `<app-sidebar-menu-item>` for its children — an arbitrarily deep
 * multi-level menu with accordion behaviour (opening one node collapses its
 * siblings, via SidebarMenuService). A parent whose subtree contains the
 * current route is highlighted as the active trail. In collapsed (icon-only)
 * mode, hovering a top-level parent opens a flyout to the right with the
 * section title and its full submenu.
 */
@Component({
  selector: 'app-sidebar-menu-item',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    NgIcon,
    UiTooltip,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    SidebarMenuItem,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let collapsedTop = collapsed() && depth() === 0;

    @if (item().children?.length) {
      @if (collapsedTop) {
        <!-- Collapsed parent: icon with a hover flyout carrying the submenu -->
        <button
          type="button"
          cdkOverlayOrigin
          #origin="cdkOverlayOrigin"
          (mouseenter)="openFlyout()"
          (mouseleave)="scheduleCloseFlyout()"
          (click)="openFlyout()"
          class="group flex w-full items-center gap-2.5 rounded-md py-2 pr-2 text-sm font-medium
                 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          [class.bg-sidebar-primary]="childActive()"
          [class.text-sidebar-primary-foreground]="childActive()"
          [class.text-sidebar-foreground]="!childActive()"
          [style.padding-left.px]="indent()"
        >
          @if (item().icon) {
            <ng-icon [name]="item().icon!" size="18" class="shrink-0" />
          }
        </button>

        <ng-template
          cdkConnectedOverlay
          [cdkConnectedOverlayOrigin]="origin"
          [cdkConnectedOverlayOpen]="flyout()"
          [cdkConnectedOverlayPositions]="flyoutPositions"
          [cdkConnectedOverlayPush]="true"
          (detach)="flyout.set(false)"
        >
          <div
            (mouseenter)="openFlyout()"
            (mouseleave)="scheduleCloseFlyout()"
            class="min-w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            <div class="px-2 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {{ item().label }}
            </div>
            <ng-container
              [ngTemplateOutlet]="flyoutList"
              [ngTemplateOutletContext]="{ $implicit: item().children!, depth: 0 }"
            />
          </div>
        </ng-template>

        <!-- Recursive flyout submenu list -->
        <ng-template #flyoutList let-nodes let-fdepth="depth">
          @for (node of nodes; track node.label) {
            @if (node.children?.length) {
              <div
                class="px-2 pb-0.5 pt-1.5 text-xs font-medium text-muted-foreground"
                [style.padding-left.px]="8 + fdepth * 12"
              >
                {{ node.label }}
              </div>
              <ng-container
                [ngTemplateOutlet]="flyoutList"
                [ngTemplateOutletContext]="{ $implicit: node.children, depth: fdepth + 1 }"
              />
            } @else {
              <a
                [routerLink]="node.route"
                routerLinkActive="bg-sidebar-primary !text-sidebar-primary-foreground"
                [routerLinkActiveOptions]="{ exact: true }"
                (click)="closeFlyout()"
                class="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                [style.padding-left.px]="8 + fdepth * 12"
              >
                @if (node.icon) {
                  <ng-icon [name]="node.icon" size="16" class="shrink-0 opacity-70" />
                }
                <span class="truncate">{{ node.label }}</span>
              </a>
            }
          }
        </ng-template>
      } @else {
        <!-- Expanded parent / expander -->
        <button
          type="button"
          (click)="toggle()"
          class="group flex w-full items-center gap-2.5 rounded-md py-2 pr-2 text-sm font-medium
                 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          [class.bg-sidebar-accent]="childActive()"
          [class.text-sidebar-accent-foreground]="childActive()"
          [class.text-sidebar-foreground]="!childActive()"
          [style.padding-left.px]="indent()"
        >
          @if (item().icon) {
            <ng-icon [name]="item().icon!" size="18" class="shrink-0" />
          }
          <span class="flex-1 truncate text-left">{{ item().label }}</span>
          @if (item().badge) {
            <span class="rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold">
              {{ item().badge }}
            </span>
          }
          <ng-icon
            name="lucideChevronDown"
            size="14"
            class="shrink-0 transition-transform"
            [class.rotate-180]="open()"
          />
        </button>

        @if (open()) {
          <div class="mt-0.5 flex flex-col gap-0.5">
            @for (child of item().children; track child.label) {
              <app-sidebar-menu-item
                [item]="child"
                [collapsed]="collapsed()"
                [depth]="depth() + 1"
                [ancestors]="path()"
              />
            }
          </div>
        }
      }
    } @else {
      <!-- Leaf link -->
      <a
        [routerLink]="item().route"
        routerLinkActive="bg-sidebar-primary !text-sidebar-primary-foreground hover:bg-sidebar-primary"
        [routerLinkActiveOptions]="{ exact: item().exact ?? true }"
        [uiTooltip]="collapsedTop ? item().label : ''"
        tooltipPosition="right"
        class="group flex items-center gap-2.5 rounded-md py-2 pr-2 text-sm text-sidebar-foreground
               transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        [style.padding-left.px]="indent()"
      >
        @if (item().icon) {
          <ng-icon [name]="item().icon!" size="18" class="shrink-0" />
        } @else if (!collapsed()) {
          <span class="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40"></span>
        }
        @if (!collapsed()) {
          <span class="flex-1 truncate">{{ item().label }}</span>
          @if (item().badge) {
            <span class="rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold">
              {{ item().badge }}
            </span>
          }
        }
      </a>
    }
  `,
})
export class SidebarMenuItem implements OnInit {
  private readonly router = inject(Router);
  private readonly menu = inject(SidebarMenuService);

  readonly item = input.required<NavItem>();
  readonly collapsed = input<boolean>(false);
  readonly depth = input<number>(0);
  /** Labels of ancestor nodes, used to build this node's unique path. */
  readonly ancestors = input<string[]>([]);

  /** Unique path from root to this node. */
  readonly path = computed(() => [...this.ancestors(), this.item().label]);

  /** Open state comes from the shared accordion service. */
  readonly open = computed(() => this.menu.isOpen(this.path()));

  /** Indent nested levels when expanded (12px base + 14px per level). */
  readonly indent = computed(() => (this.collapsed() ? 14 : 12 + this.depth() * 14));

  /** The current URL, reactive to navigation. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** True when this node's subtree contains the current route — the active trail. */
  readonly childActive = computed(() => {
    const url = this.url();
    const walk = (node: NavItem): boolean => {
      if (node.route && url.startsWith(node.route)) return true;
      return (node.children ?? []).some(walk);
    };
    return (this.item().children ?? []).some(walk);
  });

  // Collapsed-mode hover flyout.
  readonly flyout = signal(false);
  private flyoutTimer: ReturnType<typeof setTimeout> | null = null;

  /** Flyout opens to the right of the icon, top-aligned; flips up near the bottom. */
  readonly flyoutPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: 6 },
    { originX: 'end', originY: 'bottom', overlayX: 'start', overlayY: 'bottom', offsetX: 6 },
  ];

  ngOnInit(): void {
    if (this.childActive()) {
      this.menu.openBranch(this.path());
    }
  }

  toggle(): void {
    this.menu.toggle(this.path());
  }

  openFlyout(): void {
    if (this.flyoutTimer) clearTimeout(this.flyoutTimer);
    this.flyout.set(true);
  }

  /** Delayed close so the pointer can travel from the icon into the panel. */
  scheduleCloseFlyout(): void {
    if (this.flyoutTimer) clearTimeout(this.flyoutTimer);
    this.flyoutTimer = setTimeout(() => this.flyout.set(false), 150);
  }

  closeFlyout(): void {
    if (this.flyoutTimer) clearTimeout(this.flyoutTimer);
    this.flyout.set(false);
  }
}
