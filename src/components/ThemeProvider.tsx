"use client";

import { useEffect } from "react";

// Palettes: "tuli" (default, no class needed), "jaa", "sammal"
const PALETTE_CLASSES = ["theme-jaa", "theme-sammal"];

function applyTheme(dark: boolean, palette: string) {
  // dark / light
  document.documentElement.classList.toggle("dark", dark);
  // palette class (tuli = default :root, needs no class)
  PALETTE_CLASSES.forEach((c) => document.documentElement.classList.remove(c));
  if (palette !== "tuli") {
    document.documentElement.classList.add(`theme-${palette}`);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const storedMode    = localStorage.getItem("theme");
    const storedPalette = localStorage.getItem("palette") ?? "tuli";

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = storedMode === "dark" || (!storedMode && prefersDark);

    applyTheme(dark, storedPalette);
  }, []);

  return <>{children}</>;
}

// Exported so ThemeToggle can call it without duplicating logic
export { applyTheme };
