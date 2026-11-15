"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ApulaTheme = "clarity" | "glass" | "barebones";

export interface ThemeContextValue {
  theme: ApulaTheme;
  setTheme: (next: ApulaTheme) => void;
  compactWidth: boolean;
  setCompactWidth: (next: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (next: boolean) => void;
  onboardingSeen: boolean;
  markOnboardingSeen: (seen?: boolean) => void;
  resetTutorial: () => void;
}

const THEME_STORAGE_KEY = "apula-ui-theme";
const COMPACT_WIDTH_STORAGE_KEY = "apula-compact-width";
const REDUCED_MOTION_STORAGE_KEY = "apula.reducedMotion";
const ONBOARDING_STORAGE_KEY = "apula.onboardingSeen";

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Push active theme, container width, and motion flags straight onto html.
function applyDomPreferences(theme: ApulaTheme, compactWidth: boolean, reducedMotion: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.compactWidth = String(compactWidth);
  root.dataset.reducedMotion = String(reducedMotion);
  const colorSchemeMeta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (colorSchemeMeta) {
    colorSchemeMeta.content = theme === "clarity" ? "light" : "dark";
  }
}

function readStoredTheme(): ApulaTheme {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "clarity" || raw === "glass" || raw === "barebones") {
      return raw;
    }
    return "clarity";
  } catch {
    return "clarity";
  }
}

function readStoredCompactWidth(): boolean {
  try {
    return window.localStorage.getItem(COMPACT_WIDTH_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function readStoredReducedMotion(): boolean {
  try {
    const raw = window.localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    // Ignore storage block and read system motion query next.
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}

function readStoredOnboardingSeen(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ApulaTheme>("clarity");
  const [compactWidth, setCompactWidthState] = useState<boolean>(false);
  const [reducedMotion, setReducedMotionState] = useState<boolean>(false);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean>(true);

  useEffect(() => {
    const initialTheme = readStoredTheme();
    const initialCompact = readStoredCompactWidth();
    const initialReduced = readStoredReducedMotion();
    const initialSeen = readStoredOnboardingSeen();
    setThemeState(initialTheme);
    setCompactWidthState(initialCompact);
    setReducedMotionState(initialReduced);
    setOnboardingSeen(initialSeen);
    applyDomPreferences(initialTheme, initialCompact, initialReduced);

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === THEME_STORAGE_KEY ||
        event.key === COMPACT_WIDTH_STORAGE_KEY ||
        event.key === REDUCED_MOTION_STORAGE_KEY
      ) {
        const nextTheme = readStoredTheme();
        const nextCompact = readStoredCompactWidth();
        const nextReduced = readStoredReducedMotion();
        setThemeState(nextTheme);
        setCompactWidthState(nextCompact);
        setReducedMotionState(nextReduced);
        applyDomPreferences(nextTheme, nextCompact, nextReduced);
      } else if (event.key === ONBOARDING_STORAGE_KEY) {
        setOnboardingSeen(readStoredOnboardingSeen());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setTheme = useCallback(
    (next: ApulaTheme) => {
      setThemeState(next);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Ignore storage write restriction while updating DOM live.
      }
      applyDomPreferences(next, compactWidth, readStoredReducedMotion());
    },
    [compactWidth]
  );

  const setCompactWidth = useCallback(
    (next: boolean) => {
      setCompactWidthState(next);
      try {
        window.localStorage.setItem(COMPACT_WIDTH_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage write restriction.
      }
      applyDomPreferences(theme, next, reducedMotion);
    },
    [theme, reducedMotion]
  );

  const setReducedMotion = useCallback(
    (next: boolean) => {
      setReducedMotionState(next);
      try {
        window.localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage write restriction.
      }
      applyDomPreferences(theme, compactWidth, next);
    },
    [theme, compactWidth]
  );

  const markOnboardingSeen = useCallback((seen = true) => {
    setOnboardingSeen(seen);
    try {
      if (seen) {
        window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
      } else {
        window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      }
    } catch {
      // Ignore storage write restriction.
    }
  }, []);

  const resetTutorial = useCallback(() => {
    markOnboardingSeen(false);
  }, [markOnboardingSeen]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        compactWidth,
        setCompactWidth,
        reducedMotion,
        setReducedMotion,
        onboardingSeen,
        markOnboardingSeen,
        resetTutorial,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useApulaTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useApulaTheme must touch a tree wrapped in ThemeProvider");
  }
  return ctx;
}
