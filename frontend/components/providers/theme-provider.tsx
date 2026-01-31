'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes/dist/types';

/**
 * ThemeProvider
 *
 * Wraps the app with next-themes for dark/light mode support.
 *
 * Default: Dark mode
 * Design system: Dark-first with optional light theme
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="molt-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
