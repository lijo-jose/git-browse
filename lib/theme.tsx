'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type ThemeId = 'dark' | 'calm-dark' | 'dim' | 'light';
export type FontSize = 12 | 13 | 14 | 15;

interface ThemeCtx {
  theme: ThemeId;
  fontSize: FontSize;
  setTheme: (t: ThemeId) => void;
  setFontSize: (s: FontSize) => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: 'dark',
  fontSize: 13,
  setTheme: () => {},
  setFontSize: () => {},
});

export const useTheme = () => useContext(Ctx);

const THEME_KEY = 'git-browser-theme';
const FONT_KEY = 'git-browser-font-size';
const VALID_THEMES: ThemeId[] = ['dark', 'calm-dark', 'dim', 'light'];

function readStored(): { theme: ThemeId; fontSize: FontSize } {
  try {
    const t = localStorage.getItem(THEME_KEY) as ThemeId;
    const f = Number(localStorage.getItem(FONT_KEY)) as FontSize;
    return {
      theme: VALID_THEMES.includes(t) ? t : 'dark',
      fontSize: [12, 13, 14, 15].includes(f) ? f : 13,
    };
  } catch {
    return { theme: 'dark', fontSize: 13 };
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('dark');
  const [fontSize, setFontSizeState] = useState<FontSize>(13);

  useEffect(() => {
    const { theme: savedTheme, fontSize: savedFontSize } = readStored();
    setThemeState(savedTheme);
    setFontSizeState(savedFontSize);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove(...VALID_THEMES);
    html.classList.add(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-size-base', `${fontSize}px`);
    try { localStorage.setItem(FONT_KEY, String(fontSize)); } catch {}
  }, [fontSize]);

  const setTheme = (t: ThemeId) => setThemeState(t);
  const setFontSize = (s: FontSize) => setFontSizeState(s);

  return <Ctx.Provider value={{ theme, fontSize, setTheme, setFontSize }}>{children}</Ctx.Provider>;
}

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'dark',      label: 'Dark'      },
  { id: 'calm-dark', label: 'Calm Dark' },
  { id: 'dim',       label: 'Dim'       },
  { id: 'light',     label: 'Light'     },
];

export const FONT_SIZES: FontSize[] = [12, 13, 14, 15];
