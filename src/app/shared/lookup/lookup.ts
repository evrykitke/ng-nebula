import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  ConnectedPosition,
} from '@angular/cdk/overlay';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucidePlus, lucideX } from '@ng-icons/lucide';
import { LookupConfig } from './lookup-config';

/**
 * Searchable reference-picker input (see `LookupConfig`). Renders as an
 * input-like button; clicking it opens a small server-driven table in a CDK
 * connected overlay — anchored to the field, flipped above it when there is no
 * room below, and hosted at body level so scroll containers and stacking
 * contexts can't clip it. Selecting a row closes the panel, fills the input
 * with the row's display text, and binds the row key through `value`.
 */
@Component({
  selector: 'app-lookup',
  imports: [FormsModule, NgIcon, CdkConnectedOverlay, CdkOverlayOrigin],
  providers: [provideIcons({ lucideChevronDown, lucidePlus, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lookup.html',
})
export class Lookup<T = unknown> {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly config = input.required<LookupConfig<T>>();
  /** The selected row key. */
  readonly value = model<string | null>(null);
  /** The input's display text (kept in sync on select; settable by the host). */
  readonly display = model<string>('');
  /** Disables the trigger. */
  readonly disabled = input(false);

  /** A row was chosen. */
  readonly selected = output<T>();
  /** The quick-add footer action was clicked (host opens its modal). */
  readonly quickAdd = output<void>();

  readonly open = signal(false);
  readonly rows = signal<T[]>([]);
  readonly loading = signal(false);
  readonly total = signal(0);
  /** The trigger's rendered width — the panel never gets narrower than it. */
  readonly triggerWidth = signal(0);

  /** Below the field first; flip above when there is no room. */
  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  search = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchBox');
  private readonly overlay = viewChild(CdkConnectedOverlay);

  constructor() {
    // Focus the search box whenever the panel opens.
    effect(() => {
      if (this.open()) setTimeout(() => this.searchInput()?.nativeElement.focus());
    });
  }

  toggle(): void {
    if (this.disabled()) return;
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.triggerWidth.set((this.host.nativeElement as HTMLElement).offsetWidth);
    this.search = '';
    this.open.set(true);
    this.load();
  }

  clear(event: Event): void {
    event.stopPropagation();
    this.value.set(null);
    this.display.set('');
  }

  onSearch(term: string): void {
    this.search = term;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
  }

  select(row: T): void {
    this.value.set(this.config().key(row));
    this.display.set(this.config().display(row));
    this.selected.emit(row);
    this.open.set(false);
  }

  onQuickAdd(): void {
    this.open.set(false);
    this.quickAdd.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.open.set(false);
  }

  private load(): void {
    this.loading.set(true);
    this.config()
      .dataSource({
        page: 0,
        size: this.config().pageSize ?? 8,
        search: this.search.trim(),
        sort: null,
        sortDir: 'asc',
      })
      .subscribe({
        next: (page) => {
          this.rows.set(page.rows);
          this.total.set(page.total);
          this.loading.set(false);
          this.reposition();
        },
        error: () => {
          this.rows.set([]);
          this.loading.set(false);
          this.reposition();
        },
      });
  }

  /**
   * Re-evaluate the panel position after its content (and thus height)
   * changes: the overlay is measured when it opens — before rows arrive — so
   * without this a panel opened near the bottom of the viewport would grow
   * past the edge instead of flipping above the field.
   */
  private reposition(): void {
    setTimeout(() => this.overlay()?.overlayRef?.updatePosition());
  }
}
