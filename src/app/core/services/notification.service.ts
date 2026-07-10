import { Injectable, signal } from '@angular/core';

export type ToastSeverity = 'success' | 'info' | 'warn' | 'error';

export interface Toast {
  id: number;
  severity: ToastSeverity;
  summary: string;
  detail?: string;
}

/** Signal-backed toast store. Rendered by <app-toaster>. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private seq = 0;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private show(severity: ToastSeverity, summary: string, detail?: string): void {
    const id = ++this.seq;
    this._toasts.update((list) => [...list, { id, severity, summary, detail }]);
    setTimeout(() => this.dismiss(id), 4000);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  success(summary: string, detail?: string): void {
    this.show('success', summary, detail);
  }
  info(summary: string, detail?: string): void {
    this.show('info', summary, detail);
  }
  warn(summary: string, detail?: string): void {
    this.show('warn', summary, detail);
  }
  error(summary: string, detail?: string): void {
    this.show('error', summary, detail);
  }
}
