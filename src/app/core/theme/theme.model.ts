/** Theme "personality" — each carries its own palette, radius and typography. */
export type AppTheme = 'corporate' | 'professional' | 'rusty' | 'techy' | 'winformz';

/** All valid theme ids (used for storage validation). */
export const APP_THEMES: AppTheme[] = ['corporate', 'professional', 'rusty', 'techy', 'winformz'];

/** Light/dark preference. 'system' follows the OS setting. */
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeOption {
  id: AppTheme;
  name: string;
  description: string;
  /** Representative swatch color (the theme's primary). */
  color: string;
}

export interface ModeOption {
  id: ThemeMode;
  name: string;
  icon: string;
}

export const THEME_STORAGE_KEY = 'app-theme';
export const MODE_STORAGE_KEY = 'app-mode';
export const DEFAULT_THEME: AppTheme = 'professional';
export const DEFAULT_MODE: ThemeMode = 'system';

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'corporate', name: 'Corporate', description: 'Classic enterprise · crisp & dense', color: '#3b82f6' },
  { id: 'professional', name: 'Professional', description: 'Modern minimalist · soft & airy', color: '#14b8a6' },
  { id: 'rusty', name: 'Rusty', description: 'Warm industrial · soft & rounded', color: '#ea580c' },
  { id: 'techy', name: 'Techy', description: 'SaaS startup · sleek & electric', color: '#635bff' },
  { id: 'winformz', name: 'WinFormz', description: 'Classic desktop · silver & blue', color: '#0067c0' },
];

export const MODE_OPTIONS: ModeOption[] = [
  { id: 'light', name: 'Light', icon: 'lucideSun' },
  { id: 'dark', name: 'Dark', icon: 'lucideMoon' },
  { id: 'system', name: 'System', icon: 'lucideMonitor' },
];
