"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type FontSize = "sm" | "md" | "lg" | "xl";
export type Language = "zh" | "en";
export type AccentColor = "violet" | "indigo" | "emerald" | "rose" | "amber";

export interface PrefsState {
  fontSize: FontSize;
  highContrast: boolean;
  reducedMotion: boolean;
  darkMode: boolean | null; // null = follow system
  language: Language;
  accentColor: AccentColor;
  focusMode: boolean;
}

interface PrefsContextValue extends PrefsState {
  setFontSize: (v: FontSize) => void;
  setHighContrast: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
  setDarkMode: (v: boolean | null) => void;
  setLanguage: (v: Language) => void;
  setAccentColor: (v: AccentColor) => void;
  setFocusMode: (v: boolean) => void;
}

const DEFAULTS: PrefsState = {
  fontSize: "md",
  highContrast: false,
  reducedMotion: false,
  darkMode: null,
  language: "zh",
  accentColor: "violet",
  focusMode: false,
};

const STORAGE_KEY = "creator-intel-prefs";

function load(): PrefsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function save(prefs: PrefsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

function applyToDOM(prefs: PrefsState) {
  const html = document.documentElement;

  // font size
  html.dataset.fontSize = prefs.fontSize;

  // contrast
  html.dataset.contrast = prefs.highContrast ? "high" : "normal";

  // reduced motion
  html.dataset.reducedMotion = String(prefs.reducedMotion);

  // dark mode
  if (prefs.darkMode === true) {
    html.classList.add("dark");
    html.classList.remove("light");
  } else if (prefs.darkMode === false) {
    html.classList.add("light");
    html.classList.remove("dark");
  } else {
    html.classList.remove("dark", "light");
  }

  // language
  html.lang = prefs.language === "en" ? "en" : "zh-CN";

  // accent color
  const accent = prefs.accentColor ?? "violet";
  if (accent === "violet") {
    delete html.dataset.accent;
  } else {
    html.dataset.accent = accent;
  }
}

const PrefsContext = createContext<PrefsContextValue>({
  ...DEFAULTS,
  setFontSize: () => {},
  setHighContrast: () => {},
  setReducedMotion: () => {},
  setDarkMode: () => {},
  setLanguage: () => {},
  setAccentColor: () => {},
  setFocusMode: () => {},
});

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<PrefsState>(DEFAULTS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = load();
    setPrefs(stored);
    applyToDOM(stored);
    setMounted(true);
  }, []);

  // When darkMode === null (auto), follow prefers-color-scheme
  useEffect(() => {
    if (prefs.darkMode !== null) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      const html = document.documentElement;
      if (mq.matches) {
        html.classList.add("dark");
        html.classList.remove("light");
      } else {
        html.classList.remove("dark");
        html.classList.add("light");
      }
    }
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [prefs.darkMode]);

  const update = useCallback((partial: Partial<PrefsState>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      save(next);
      applyToDOM(next);
      return next;
    });
  }, []);

  const value: PrefsContextValue = {
    ...(mounted ? prefs : DEFAULTS),
    setFontSize: (v) => update({ fontSize: v }),
    setHighContrast: (v) => update({ highContrast: v }),
    setReducedMotion: (v) => update({ reducedMotion: v }),
    setDarkMode: (v) => update({ darkMode: v }),
    setLanguage: (v) => update({ language: v }),
    setAccentColor: (v) => update({ accentColor: v }),
    setFocusMode: (v) => update({ focusMode: v }),
  };

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  return useContext(PrefsContext);
}
