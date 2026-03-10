import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

type Theme = "light" | "dark";

const THEME_COLORS: Record<Theme, string> = {
  light: "#F7F4EE",
  dark: "#0B0E13",
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setThemeColorOverride: (color: string | null) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function updateThemeColorMeta(color: string) {
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((meta) => {
    meta.setAttribute("content", color);
  });
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("costar-theme") as Theme;
      if (stored) return stored;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  const overrideRef = useRef<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("costar-theme", theme);

    if (!overrideRef.current) {
      updateThemeColorMeta(THEME_COLORS[theme]);
    }
  }, [theme]);

  const setThemeColorOverride = useCallback((color: string | null) => {
    overrideRef.current = color;
    if (color) {
      updateThemeColorMeta(color);
    } else {
      updateThemeColorMeta(THEME_COLORS[theme]);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, setThemeColorOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
