import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AppTheme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'kp_theme';
const DEFAULT_THEME: AppTheme = 'dark';

type ThemeContextValue = {
  theme: AppTheme;
  isLightTheme: boolean;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function normalizeTheme(value: unknown): AppTheme | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'dark' || normalized === 'light') return normalized;
  return null;
}

function resolveInitialTheme(): AppTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY)) || DEFAULT_THEME;
}

function applyTheme(theme: AppTheme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('theme-light', theme === 'light');
  document.documentElement.classList.toggle('theme-dark', theme === 'dark');
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => resolveInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const contextValue = useMemo<ThemeContextValue>(() => ({
    theme,
    isLightTheme: theme === 'light',
    setTheme: (nextTheme) => setThemeState(nextTheme),
    toggleTheme: () => setThemeState((current) => (current === 'light' ? 'dark' : 'light')),
  }), [theme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export { ThemeProvider, useTheme };
