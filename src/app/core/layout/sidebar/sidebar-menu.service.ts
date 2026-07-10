import { Injectable, signal } from '@angular/core';

const SEP = '';

/**
 * Accordion state for the sidebar. Tracks a single "open chain" — the path of
 * ids from the root down to the deepest open node — so opening a node collapses
 * its siblings at every level. Provided at the Sidebar component so each sidebar
 * instance owns its own state.
 */
@Injectable()
export class SidebarMenuService {
  /** Cumulative ids of every currently-open node along one branch. */
  private readonly openChain = signal<string[]>([]);

  isOpen(path: string[]): boolean {
    return this.openChain().includes(path.join(SEP));
  }

  /** Open this node's branch (closing siblings), or close it if already open. */
  toggle(path: string[]): void {
    const id = path.join(SEP);
    if (this.openChain().includes(id)) {
      // Collapse this node — keep only its ancestors open.
      this.openChain.set(this.prefixes(path).slice(0, -1));
    } else {
      this.openChain.set(this.prefixes(path));
    }
  }

  /** Open a branch outright (used to auto-expand the active route on load). */
  openBranch(path: string[]): void {
    this.openChain.set(this.prefixes(path));
  }

  private prefixes(path: string[]): string[] {
    return path.map((_, i) => path.slice(0, i + 1).join(SEP));
  }
}
