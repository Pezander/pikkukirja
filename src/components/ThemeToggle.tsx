"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyTheme } from "@/components/ThemeProvider";

type Palette = "tuli" | "jaa" | "sammal";

const PALETTES: { key: Palette; label: string; swatch: string }[] = [
  { key: "tuli",   label: "Tuli",   swatch: "oklch(0.510 0.130 35)"  },
  { key: "jaa",    label: "Jää",    swatch: "oklch(0.490 0.120 265)" },
  { key: "sammal", label: "Sammal", swatch: "oklch(0.420 0.080 150)" },
];

export function ThemeToggle() {
  const [dark,    setDark]    = useState(false);
  const [palette, setPalette] = useState<Palette>("tuli");
  const [open,    setOpen]    = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setPalette((localStorage.getItem("palette") as Palette) ?? "tuli");
  }, []);

  function toggleDark() {
    const isDark = !dark;
    localStorage.setItem("theme", isDark ? "dark" : "light");
    setDark(isDark);
    applyTheme(isDark, palette);
  }

  function choosePalette(p: Palette) {
    localStorage.setItem("palette", p);
    setPalette(p);
    applyTheme(dark, p);
    setOpen(false);
  }

  const current = PALETTES.find((p) => p.key === palette)!;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, position: "relative" }}>
      {/* Palette picker trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Vaihda värimaailma"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 9px", borderRadius: 8, border: "1px solid var(--border)",
          background: "transparent", cursor: "pointer", fontSize: 12,
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontWeight: 500, color: "var(--foreground)",
          letterSpacing: "0.04em",
        }}
      >
        <span style={{
          width: 10, height: 10, borderRadius: "50%",
          background: current.swatch, flexShrink: 0,
          boxShadow: "0 0 0 1.5px var(--border)",
        }}/>
        {current.label}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Click-away backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
          />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
            background: "var(--popover)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "6px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)",
            minWidth: 130,
          }}>
            {PALETTES.map((p) => (
              <button
                key={p.key}
                onClick={() => choosePalette(p.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  width: "100%", padding: "7px 10px", borderRadius: 7,
                  border: "none", background: palette === p.key ? "var(--accent)" : "transparent",
                  cursor: "pointer", fontSize: 13,
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  fontWeight: palette === p.key ? 500 : 400,
                  color: "var(--foreground)", textAlign: "left",
                  letterSpacing: "0.03em",
                }}
              >
                <span style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: p.swatch, flexShrink: 0,
                  boxShadow: "0 0 0 1.5px var(--border)",
                }}/>
                {p.label}
                {palette === p.key && (
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)" }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Light / dark toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleDark}
        title={dark ? "Vaalea teema" : "Tumma teema"}
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  );
}
