/* Interface colour customization.
   Only the product accent and page background change; semantic status colours
   and the PayPal button stay untouched so meaning and brand safety survive. */

export interface ThemeColors {
  accent: string;
  background: string;
}

export const ACCENT_PRESETS = ['#0d5a45', '#1f4e79', '#8a4b2a', '#5b3a63', '#2f3436'] as const;
export const BACKGROUND_PRESETS = ['#f3f4ee', '#f1f4f7', '#f7f1e8', '#ffffff'] as const;
export const DEFAULT_THEME: ThemeColors = { accent: ACCENT_PRESETS[0], background: BACKGROUND_PRESETS[0] };

const STORAGE_KEY = 'gr_theme';

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function normalizeHex(input: string): string | null {
  const value = input.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return `#${value.toLowerCase()}`;
}

function rgbOf(hex: string): [number, number, number] {
  const value = normalizeHex(hex) ?? DEFAULT_THEME.accent;
  return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];
}

function hexOf(rgb: [number, number, number]): string {
  return `#${rgb.map((part) => clamp(part).toString(16).padStart(2, '0')).join('')}`;
}

function mix(a: string, b: string, weightOfB: number): string {
  const ar = rgbOf(a);
  const br = rgbOf(b);
  return hexOf([
    ar[0] + (br[0] - ar[0]) * weightOfB,
    ar[1] + (br[1] - ar[1]) * weightOfB,
    ar[2] + (br[2] - ar[2]) * weightOfB,
  ]);
}

function darken(hex: string, amount: number): string {
  return mix(hex, '#000000', amount);
}

function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((part) => part / 255);
  const channel = (value: number) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

export function readableOn(hex: string): string {
  return luminance(hex) > 0.55 ? '#101410' : '#ffffff';
}

export function loadTheme(): ThemeColors {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ThemeColors> | null;
    const accent = normalizeHex(parsed?.accent ?? '') ?? DEFAULT_THEME.accent;
    const background = normalizeHex(parsed?.background ?? '') ?? DEFAULT_THEME.background;
    return { accent, background };
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme: ThemeColors): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const accent = normalizeHex(theme.accent) ?? DEFAULT_THEME.accent;
  const background = normalizeHex(theme.background) ?? DEFAULT_THEME.background;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-strong', darken(accent, 0.24));
  root.style.setProperty('--accent-tint', mix(accent, '#ffffff', 0.9));
  root.style.setProperty('--accent-contrast', readableOn(accent));
  root.style.setProperty('--bg', background);
  root.style.setProperty('--surface-2', mix(background, '#ffffff', 0.55));
  root.style.setProperty(
    '--shadow-float',
    '0 2px 4px rgba(19, 23, 19, 0.12), 0 14px 28px -14px rgba(19, 23, 19, 0.35)',
  );
  root.dataset.hasTheme = 'true';
}

export function saveTheme(theme: ThemeColors): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
}

export function resetTheme(): ThemeColors {
  const theme = { ...DEFAULT_THEME };
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
  applyTheme(theme);
  return theme;
}

export function initTheme(): ThemeColors {
  const theme = loadTheme();
  applyTheme(theme);
  return theme;
}
