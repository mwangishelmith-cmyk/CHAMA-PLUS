import PropTypes from "prop-types";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ui.theme";

const ThemeContext = createContext(null);

/**
 * Dark/light theme provider.
 * The choice is persisted in localStorage and re-applied on mount, so the
 * toggle survives a full page reload. Falls back to the OS preference.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("light");

  // Read the stored preference after hydration (localStorage is browser-only).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setThemeState(stored || (prefersDark ? "dark" : "light"));
  }, []);

  // Reflect the theme on <html> for the `dark:` variant.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((next) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [theme, setTheme],
  );

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, isDark: theme === "dark" }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

ThemeProvider.propTypes = { children: PropTypes.node };

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
