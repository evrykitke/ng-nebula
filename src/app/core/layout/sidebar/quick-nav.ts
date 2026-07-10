import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { UiTooltip } from '../../../shared/ui/tooltip';
import { LayoutService } from '../layout.service';
import { AuthService } from '../../auth/auth.service';
import { ADMIN_NAV_ITEM, ADMIN_PAGES, NAV_ITEMS, NavItem, filterNav } from '../nav.model';

/**
 * Quick navigation, at the top of the sidebar: type a page name, Enter to go;
 * Ctrl/Cmd+K focuses it from anywhere (expanding a collapsed sidebar first).
 * In the icon-only rail it renders as a search icon that expands + focuses.
 */
@Component({
  selector: 'app-quick-nav',
  imports: [NgIcon, UiTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (iconOnly()) {
      <button
        type="button"
        (click)="expandAndFocus()"
        uiTooltip="Search — Ctrl K"
        tooltipPosition="right"
        class="flex w-full items-center rounded-md py-2 text-sidebar-foreground transition-colors
               hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        style="padding-left: 14px"
        aria-label="Search"
      >
        <ng-icon name="lucideSearch" size="18" class="shrink-0" />
      </button>
    } @else {
      <div class="relative">
        <ng-icon
          name="lucideSearch"
          size="15"
          class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sidebar-foreground/60"
        />
        <input
          #searchBox
          type="text"
          placeholder="Go to…"
          [value]="query()"
          (input)="onInput(searchBox.value)"
          (focus)="open.set(true)"
          (blur)="open.set(false)"
          (keydown)="onKeydown($event)"
          class="h-9 w-full rounded-md border border-sidebar-border bg-sidebar-accent/40 pl-8 pr-12
                 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/55
                 focus:bg-sidebar-accent/60 focus:outline-none focus:ring-2 focus:ring-sidebar-ring"
          aria-label="Go to page"
        />
        <kbd
          class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border
                 border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px] font-medium
                 text-sidebar-foreground/60"
          >Ctrl K</kbd
        >

        @if (open() && matches().length > 0) {
          <div
            class="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border
                   bg-popover p-1 text-popover-foreground shadow-md"
          >
            @for (m of matches(); track m.route; let i = $index) {
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm"
                [class.bg-accent]="i === active()"
                (mousedown)="$event.preventDefault(); goTo(m.route)"
                (mouseenter)="active.set(i)"
              >
                @if (m.icon) {
                  <ng-icon [name]="m.icon" size="15" class="shrink-0 text-muted-foreground" />
                }
                <span class="min-w-0 flex-1 truncate text-left">{{ m.label }}</span>
                @if (m.section) {
                  <span class="shrink-0 text-[11px] text-muted-foreground">{{ m.section }}</span>
                }
              </button>
            }
          </div>
        }
      </div>
    }
  `,
})
export class QuickNav {
  private readonly router = inject(Router);
  private readonly layout = inject(LayoutService);
  private readonly auth = inject(AuthService);

  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');

  readonly iconOnly = computed(() => !this.layout.isMobile() && this.layout.collapsed());

  readonly query = signal('');
  readonly open = signal(false);
  readonly active = signal(0);

  /** Flat, permission-filtered list of navigable pages (leafs with a route). */
  private readonly pages = computed(() => {
    const flat: { label: string; route: string; icon?: string; section?: string }[] = [];
    const walk = (items: NavItem[], section?: string) => {
      for (const item of items) {
        if (item.route) flat.push({ label: item.label, route: item.route, icon: item.icon, section });
        if (item.children) walk(item.children, item.label);
      }
    };
    const source: NavItem[] = [
      ...NAV_ITEMS,
      { ...ADMIN_NAV_ITEM, children: ADMIN_PAGES },
    ];
    walk(filterNav(source, (names) => this.auth.hasAnyPermission(names)));
    return flat;
  });

  readonly matches = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return [];
    return this.pages()
      .filter((p) => p.label.toLowerCase().includes(q) || p.section?.toLowerCase().includes(q))
      .slice(0, 8);
  });

  onInput(value: string): void {
    this.query.set(value);
    this.active.set(0);
    this.open.set(true);
  }

  onKeydown(event: KeyboardEvent): void {
    const matches = this.matches();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.active.set(Math.min(this.active() + 1, matches.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active.set(Math.max(this.active() - 1, 0));
        break;
      case 'Enter': {
        const match = matches[this.active()];
        if (match) this.goTo(match.route);
        break;
      }
      case 'Escape':
        this.query.set('');
        this.searchBox()?.nativeElement.blur();
        break;
    }
  }

  goTo(route: string): void {
    this.query.set('');
    this.searchBox()?.nativeElement.blur();
    void this.router.navigateByUrl(route);
  }

  /** In the icon-only rail: expand the sidebar, then focus the input. */
  expandAndFocus(): void {
    this.layout.setCollapsed(false);
    setTimeout(() => this.searchBox()?.nativeElement.focus(), 220);
  }

  /** Ctrl/Cmd+K focuses the quick-nav from anywhere. */
  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (this.iconOnly()) {
        this.expandAndFocus();
      } else if (this.layout.isMobile() && !this.layout.mobileOpen()) {
        this.layout.toggleSidebar();
        setTimeout(() => this.searchBox()?.nativeElement.focus(), 220);
      } else {
        this.searchBox()?.nativeElement.focus();
      }
    }
  }
}
