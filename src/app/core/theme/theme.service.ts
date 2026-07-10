import { Injectable, computed, effect, signal } from '@angular/core';
import {
  APP_THEMES,
  AppTheme,
  DEFAULT_MODE,
  DEFAULT_THEME,
  MODE_OPTIONS,
  MODE_STORAGE_KEY,
  ModeOption,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  ThemeMode,
  ThemeOption,
} from './theme.model';

/**
 * Singleton theme manager. Two independent axes:
 *  - `theme`  → the personality (palette + radius + typography), via `<html data-theme>`
 *  - `mode`   → light / dark / system, via the `.dark` class (Spartan's dark variant)
 * Both persist to localStorage; 'system' tracks the OS via matchMedia.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemPrefersDark = signal(this.media.matches);

  readonly theme = signal<AppTheme>(this.loadTheme());
  readonly mode = signal<ThemeMode>(this.loadMode());

  readonly themes: readonly ThemeOption[] = THEME_OPTIONS;
  readonly modes: readonly ModeOption[] = MODE_OPTIONS;

  /** The effective light/dark state after resolving 'system'. */
  readonly isDark = computed(() =>
    this.mode() === 'system' ? this.systemPrefersDark() : this.mode() === 'dark',
  );

  /** Skip the cross-fade on the very first apply (initial page paint). */
  private firstApply = true;
  private transitionTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.media.addEventListener('change', (e) => this.systemPrefersDark.set(e.matches));

    effect(() => {
      const root = document.documentElement;
      if (!this.firstApply) {
        root.classList.add('theme-transition');
        clearTimeout(this.transitionTimer);
        this.transitionTimer = setTimeout(() => root.classList.remove('theme-transition'), 300);
      }
      this.firstApply = false;
      root.setAttribute('data-theme', this.theme());
      root.classList.toggle('dark', this.isDark());
      localStorage.setItem(THEME_STORAGE_KEY, this.theme());
      localStorage.setItem(MODE_STORAGE_KEY, this.mode());
    });
  }

  setTheme(theme: AppTheme): void {
    this.theme.set(theme);
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private loadTheme(): AppTheme {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null;
    return saved && APP_THEMES.includes(saved) ? saved : DEFAULT_THEME;
  }

  private loadMode(): ThemeMode {
    const saved = localStorage.getItem(MODE_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : DEFAULT_MODE;
  }
}
