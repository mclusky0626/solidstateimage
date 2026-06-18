export type Theme = 'dark' | 'light' | 'auto';

const THEME_KEY = 'ssi.theme';
const ACCENT_KEY = 'ssi.accent';

export interface AccentPreset {
  name: string;
  value: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { name: '블루', value: '#7aa2ff' },
  { name: '퍼플', value: '#b07bff' },
  { name: '그린', value: '#5de89e' },
  { name: '오렌지', value: '#ff9f5e' },
  { name: '핑크', value: '#ff7aaf' },
  { name: '티일', value: '#5ecfcf' },
];

export function getTheme(): Theme {
  return (localStorage.getItem(THEME_KEY) as Theme) || 'dark';
}

export function saveTheme(t: Theme) {
  localStorage.setItem(THEME_KEY, t);
}

export function getAccent(): string {
  return localStorage.getItem(ACCENT_KEY) || '#7aa2ff';
}

export function saveAccent(a: string) {
  localStorage.setItem(ACCENT_KEY, a);
}

export function applyTheme(theme: Theme, accent: string) {
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  root.style.setProperty('--accent-user', accent);
}

export function initTheme() {
  applyTheme(getTheme(), getAccent());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'auto') applyTheme('auto', getAccent());
  });
}
