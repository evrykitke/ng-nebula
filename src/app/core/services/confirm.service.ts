import { Injectable, signal } from '@angular/core';

export type ConfirmTone = 'default' | 'danger';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * Signal-backed confirmation store. Rendered by <app-confirm-dialog>.
 * Call `ask()` and await the boolean instead of using the native `confirm()`.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _current = signal<ConfirmState | null>(null);
  readonly current = this._current.asReadonly();

  /** Open a confirmation dialog; resolves `true` if confirmed, `false` if dismissed. */
  ask(options: ConfirmOptions): Promise<boolean> {
    // If one is already open, resolve it as cancelled before replacing.
    this._current()?.resolve(false);
    return new Promise<boolean>((resolve) => {
      this._current.set({ ...options, resolve });
    });
  }

  confirm(): void {
    const c = this._current();
    if (c) {
      c.resolve(true);
      this._current.set(null);
    }
  }

  cancel(): void {
    const c = this._current();
    if (c) {
      c.resolve(false);
      this._current.set(null);
    }
  }
}
